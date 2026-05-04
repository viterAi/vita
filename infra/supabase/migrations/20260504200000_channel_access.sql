-- 008 · Channel-level access control (Palantir-informed)
--
-- Maps Palantir's granular-policy + restricted-view + project-permissions model into
-- Postgres RLS via a SECURITY DEFINER function.
--
-- Three principles, lifted from the May 4 research + Apr 21 Shaul thesis:
--   1. Membership is DERIVED from participation (chat-level), not granted by an admin
--   2. Access is computed at REQUEST time via a function, not pre-cached
--   3. Default-CLOSED — channels are scope='private'; explicit memberships unlock content
--
-- v1 implements the runtime function. v2 adds markings (mandatory binary eligibility),
-- time-bounded shares, and on-behalf-of-human attribution. v3 adds cell-level
-- (per-property) policies. Schema today supports the function-evolution path without
-- migrations: extend `user_can_read_channel` body, never the signature.

-- ────────────────────────────────────────────────────────────────────
-- 1. channels.scope  ─  private / tenant-wide
-- ────────────────────────────────────────────────────────────────────

alter table public.channels
  add column if not exists scope text not null default 'private'
    check (scope in ('private','tenant'));

comment on column public.channels.scope is
  'private: explicit channel_memberships gate content; tenant: all tenant members read';

-- Backfill existing rows: keep default 'private' for everything.
-- Override below for vita-chat:default which is tenant-scope by design.
update public.channels set scope = 'tenant'
 where kind = 'vita-chat' and identifier = 'default';

-- ────────────────────────────────────────────────────────────────────
-- 2. channel_memberships  ─  the granular-policy seed (per Palantir)
-- ────────────────────────────────────────────────────────────────────

create table public.channel_memberships (
  channel_id   uuid not null references public.channels(id) on delete cascade,
  principal_id uuid not null references public.principals(id) on delete cascade,
  role         text not null default 'reader'
                check (role in ('owner','writer','reader')),
  added_at     timestamptz not null default now(),
  added_by     uuid references auth.users(id) on delete set null,
  source       text not null default 'derived',  -- 'derived' (from participation) | 'granted' (admin) | 'shared' (cross-channel)
  primary key (channel_id, principal_id)
);

create index channel_memberships_principal on public.channel_memberships (principal_id);

alter table public.channel_memberships enable row level security;

create policy channel_memberships_self_read on public.channel_memberships
  for select using (
    -- Self: I see my own memberships
    exists (
      select 1 from public.principals p
       where p.id = channel_memberships.principal_id and p.user_id = auth.uid()
    )
    or
    -- Co-member: I can see who else is in a channel I'm in
    exists (
      select 1
        from public.channel_memberships my_cm
        join public.principals my_p on my_p.id = my_cm.principal_id
       where my_cm.channel_id = channel_memberships.channel_id
         and my_p.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────────
-- 3. user_can_read_channel(channel_id) — runtime evaluation
-- ────────────────────────────────────────────────────────────────────
-- This is the granular-policy function. Called from RLS policies on every
-- table that has channel_id. Evolvable: v2 adds time-bounded checks here;
-- v3 adds marking checks; v4 adds on-behalf-of agent attribution.
-- The signature stays stable; the body grows.

create or replace function public.user_can_read_channel(p_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  -- Layer A: the channel's tenant must be one of mine
  -- Layer B: either the channel is tenant-scope OR I'm an explicit member
  select exists (
    select 1
      from public.channels c
      join public.tenant_memberships tm
        on tm.tenant_id = c.tenant_id
       and tm.user_id = auth.uid()
     where c.id = p_channel_id
       and (
         c.scope = 'tenant'
         or exists (
           select 1
             from public.channel_memberships cm
             join public.principals p on p.id = cm.principal_id
            where cm.channel_id = c.id
              and p.user_id = auth.uid()
         )
       )
  );
$$;

comment on function public.user_can_read_channel(uuid) is
  'Runtime granular policy: returns true iff auth.uid() can read content in p_channel_id.
   Combines tenant membership + (channel scope = tenant OR explicit channel membership).
   Stable signature; body extended in v2 (time-bounded shares) / v3 (markings / cell-level).';

-- ────────────────────────────────────────────────────────────────────
-- 4. Update RLS policies on content tables to use the function
-- ────────────────────────────────────────────────────────────────────

-- l1_events: channel-gated reads
drop policy if exists l1_events_tenant_read on public.l1_events;
create policy l1_events_channel_read on public.l1_events for select
  using (
    tenant_id in (select tenant_id from public.tenant_memberships where user_id = auth.uid())
    and (
      channel_id is null  -- system / non-channel events
      or public.user_can_read_channel(channel_id)
    )
  );

-- l0_artifacts: source_type derives channel where applicable.
-- For now: tenant-scoped read; channel filtering happens via the events that point to artifacts.
-- (Direct l0_artifact reads are operator-tier; channel filtering at L1 is sufficient for content gating.)
-- Keep existing tenant-only RLS on l0_artifacts.

-- l2_syntheses: scoped synthesis is tenant-readable; channel filtering implicit via cited events.
-- (If a synthesis cites events across multiple channels, the user must have access to the synthesis row,
-- but the cited events themselves are individually channel-gated by l1_events policy.)
-- Keep existing tenant-only RLS.

-- l3_surfaces: same logic as l2_syntheses.

-- ────────────────────────────────────────────────────────────────────
-- 5. Storage bucket policies (l0-whatsapp) — applied separately on bucket creation
-- ────────────────────────────────────────────────────────────────────
-- See infra/supabase/storage/policies.sql (created when bucket is provisioned).
-- Pattern: object path = '<tenant-slug>/<chat-slug>/<file>',
-- policy joins through channels (kind='whatsapp', identifier=chat-slug)
-- and calls user_can_read_channel(c.id).

-- ────────────────────────────────────────────────────────────────────
-- 6. Helper: list channels visible to current user (for app sidebar)
-- ────────────────────────────────────────────────────────────────────

create or replace view public.my_channels as
select c.id, c.tenant_id, c.kind, c.identifier, c.display_name, c.scope, c.metadata, c.created_at
  from public.channels c
 where public.user_can_read_channel(c.id);

comment on view public.my_channels is
  'Channels the current authenticated user can read (per RLS + scope + memberships).
   Used by app sidebar / channel-picker. Service-role sees everything (RLS bypass).';
