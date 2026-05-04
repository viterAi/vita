-- 006 · LLM call log
-- Every LLM completion (synthesizer, eval, future MCP chat) writes one row here.
-- Schema is a derivative of shelet.agent_logs + viter.chat_turns, narrowed to
-- what we actually need for eval + cost roll-ups.
--
-- Hot-path lifecycle:
--   1. INSERT row with status='pending', started_at=now(), model_requested, prompt_version
--   2. After completion: UPDATE status='ok', completed_at, model_used, generation_id,
--      prompt_tokens, completion_tokens, cost_usd (computed client-side or by webhook)
--   3. async (optional): openrouter-cost-enrich edge function patches generation_id
--      rows where cost_usd IS NULL by hitting OR /api/v1/generation/{id}

create table public.llm_call_log (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,

  -- ─── what called this ────────────────────────────────────────────
  caller              text not null,            -- 'synthesizer.day' | 'eval.run' | 'extractor.embedding' | 'mcp.chat'
  caller_ref          uuid,                     -- e.g. l2_synthesis.id, eval_run.id
  prompt_version      text,                     -- 'day-prompt-v2' (free-text; bump per prompt change)

  -- denormalized scope tags for fast filtering (e.g. "all calls for day=2026-04-29")
  scope_kind          text,
  scope_key           text,

  -- ─── what was asked ──────────────────────────────────────────────
  model_requested     text not null,            -- 'anthropic/claude-opus-4.5' (OpenRouter format)
  parameters          jsonb not null default '{}'::jsonb,  -- {max_tokens, temperature, ...}
  system_prompt_hash  text,                     -- sha256 of system prompt
  user_prompt_chars   integer,                  -- length only by default
  user_prompt_hash    text,                     -- sha256 of user prompt

  -- ─── what came back ──────────────────────────────────────────────
  status              text not null default 'pending'
    check (status in ('pending','running','ok','failed','timeout','cancelled')),
  model_used          text,                     -- what OpenRouter actually routed to
  provider_name       text,                     -- 'anthropic' | 'fireworks' | 'together' (OR's underlying)
  generation_id       text,                     -- OpenRouter id (used by webhook for async cost)
  finish_reason       text,                     -- 'stop' | 'length' | 'tool_use' | 'error'

  -- ─── tokens + cost ───────────────────────────────────────────────
  prompt_tokens       integer,
  completion_tokens   integer,
  reasoning_tokens    integer,                  -- thinking models
  cached_tokens       integer,                  -- prompt-cached portion
  total_tokens        integer,
  cost_usd            numeric(12,6),            -- enriched async or computed client-side

  -- ─── timings ─────────────────────────────────────────────────────
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  latency_ms          integer,                  -- our wall-clock (started_at → completed_at)
  generation_time_ms  integer,                  -- model-side from OR

  -- ─── diagnostics ─────────────────────────────────────────────────
  error_message       text,
  error_code          text,

  -- ─── full payloads (gated by LLM_DEBUG_PAYLOADS env on the caller side) ──
  raw_request         jsonb,                    -- {} or {length, truncated:true} when debug off
  raw_response        jsonb,                    -- same

  metadata            jsonb not null default '{}'::jsonb,

  unique (tenant_id, generation_id) deferrable initially deferred
);
-- (Postgres can't enforce unique-where-not-null directly; partial unique index instead)
drop constraint if exists llm_call_log_tenant_id_generation_id_key on public.llm_call_log;
alter table public.llm_call_log drop constraint if exists llm_call_log_tenant_id_generation_id_key;
create unique index llm_log_unique_gen on public.llm_call_log (tenant_id, generation_id) where generation_id is not null;

create index llm_log_caller   on public.llm_call_log (tenant_id, caller, started_at desc);
create index llm_log_model    on public.llm_call_log (tenant_id, model_requested, started_at desc);
create index llm_log_pending  on public.llm_call_log (status, started_at) where status in ('pending','running');
create index llm_log_scope    on public.llm_call_log (tenant_id, scope_kind, scope_key, started_at desc) where scope_kind is not null;
create index llm_log_cost_null on public.llm_call_log (generation_id) where status = 'ok' and cost_usd is null and generation_id is not null;
-- ↑ this index drives the cost-enrich worker — find rows that need cost backfill

alter table public.llm_call_log enable row level security;
create policy llm_log_tenant_read on public.llm_call_log for select using (tenant_id = public.current_tenant_id());

-- ─── helper view: aggregate cost per (caller, scope, day) ─────────
create view public.llm_cost_daily as
select
  tenant_id,
  caller,
  scope_kind,
  date_trunc('day', started_at at time zone 'Asia/Jerusalem') as day,
  count(*) as n_calls,
  sum(prompt_tokens) as prompt_tokens,
  sum(completion_tokens) as completion_tokens,
  sum(cost_usd) as cost_usd,
  avg(latency_ms)::int as avg_latency_ms,
  percentile_cont(0.5) within group (order by latency_ms) as p50_latency_ms,
  percentile_cont(0.95) within group (order by latency_ms) as p95_latency_ms
from public.llm_call_log
where status = 'ok'
group by tenant_id, caller, scope_kind, day;
