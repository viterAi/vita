-- 007 · Evals — fixtures + runs
-- Steals viter.canary_fixtures / canary_runs shape, adapted for L2 model evaluation.
--
-- Lifecycle:
--   1. eval_fixtures: declarative test cases with rubric (versioned by prompt_version)
--   2. eval_runs:    one row per (fixture × model × replica), filled by eval-l2-models.ts
--   3. eval_runs.checks jsonb stores the 11-point rubric outcome, score is aggregate
--   4. queries: SELECT model, AVG(score), AVG(cost_usd), STDDEV(score) FROM eval_runs ...

create table public.eval_fixtures (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  name            text not null,                -- 'day-l2-apr29' | 'meeting-wework-1100' | …
  scope_kind      text not null,                -- 'day' | 'meeting' | 'person' | 'concept'
  scope_key       text not null,                -- '2026-04-29' | 'meeting:wework-…'
  prompt_version  text not null,                -- 'day-prompt-v2' — bump per prompt change
  rubric          jsonb not null,               -- {criteria: [{id, name, type, weight, threshold, ...}], pass_threshold: 8}
  active          boolean not null default true,
  note            text,
  created_at      timestamptz not null default now(),
  unique (tenant_id, name, prompt_version)
);
create index eval_fixtures_active on public.eval_fixtures (tenant_id, active) where active;

create table public.eval_runs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  fixture_id      uuid not null references public.eval_fixtures(id) on delete cascade,
  llm_call_id     uuid references public.llm_call_log(id) on delete set null,

  -- model identity (denorm from llm_call_log for eval queries that don't join)
  model_requested text not null,                -- as asked
  model_used      text,                         -- as routed
  provider_name   text,
  replica_n       integer not null default 1,   -- 1..N for consistency runs

  -- output
  body            text,
  cited_event_ids uuid[],
  body_chars      integer,
  body_lines      integer,

  -- 11-point rubric scored programmatically (subjective items can be added later)
  -- Shape: {criterion_id: {pass: bool, value: any, note?: string}, ...}
  checks          jsonb not null default '{}'::jsonb,
  score           numeric,                      -- aggregate (0..max)
  max_score       numeric,                      -- denominator (depends on rubric)
  pass            boolean,                      -- score >= rubric.pass_threshold

  -- timing + cost (denorm from llm_call_log for fast comparison queries)
  latency_ms      integer,
  cost_usd        numeric(12,6),

  notes           text,
  created_at      timestamptz not null default now()
);
create index eval_runs_fixture on public.eval_runs (fixture_id, created_at desc);
create index eval_runs_model   on public.eval_runs (tenant_id, model_requested, created_at desc);
create index eval_runs_score   on public.eval_runs (fixture_id, score desc nulls last);

alter table public.eval_fixtures enable row level security;
alter table public.eval_runs     enable row level security;
create policy eval_fixtures_tenant_read on public.eval_fixtures for select using (tenant_id = public.current_tenant_id());
create policy eval_runs_tenant_read     on public.eval_runs     for select using (tenant_id = public.current_tenant_id());

-- ─── helper view: leaderboard per fixture ─────────────────────────
create view public.eval_leaderboard as
select
  f.name                                               as fixture,
  f.prompt_version,
  r.model_requested                                    as model,
  count(*)                                             as n_runs,
  avg(r.score)::numeric(6,3)                           as avg_score,
  stddev(r.score)::numeric(6,3)                        as stddev_score,
  avg(r.latency_ms)::int                               as avg_latency_ms,
  avg(r.cost_usd)::numeric(8,5)                        as avg_cost_usd,
  bool_or(r.pass)                                      as ever_passed,
  bool_and(r.pass)                                     as always_passed
from public.eval_runs r
join public.eval_fixtures f on f.id = r.fixture_id
group by f.name, f.prompt_version, r.model_requested
order by f.name, avg_score desc nulls last;
