-- 004 · RLS for l0_source_types (global read, service-role-only write)
--
-- l0_source_types is a global registry of known L0 source types — not tenant-scoped.
-- Reads are public (any authenticated session can SELECT). Writes are restricted to
-- service_role (managed by migrations + admin tooling, never by app code).

alter table public.l0_source_types enable row level security;

create policy l0_source_types_public_read
  on public.l0_source_types
  for select
  using (true);

-- no INSERT/UPDATE/DELETE policies → blocks anon + authenticated; service_role bypasses RLS
