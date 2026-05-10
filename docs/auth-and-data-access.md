# Auth & Per-User Data Access

> How authentication is managed and how data retrieval is scoped per user in the Vita Supabase backend.

---

## Auth Management

Auth is handled entirely by **Supabase Auth** (`auth.uid()`). The app uses a **tenant/membership model** — a user logs in once and gets access to one or more **tenants** (workspaces).

### Identity Tables

| Table | Role |
|---|---|
| `auth.users` | Supabase-managed login credentials |
| `tenant_memberships` | Maps `user_id → tenant_id` (which orgs the user belongs to) |
| `tenant_members` | Secondary membership table |
| `principals` | Named actors within a tenant (e.g. a person or bot identity) |
| `channel_memberships` | Which channels a principal has access to |

---

## RLS Helper Functions

Every table has **Row Level Security (RLS) enabled**. All access decisions flow through three helper functions:

### `current_tenant_id()`

The foundational function. Returns the tenant the logged-in user belongs to.

```sql
SELECT tenant_id
  FROM public.tenant_memberships
 WHERE user_id = auth.uid()
 LIMIT 1;
```

### `is_tenant_member(tenant_id)`

Checks if the current user is a member of a specific tenant.

```sql
SELECT EXISTS (
  SELECT 1 FROM public.tenant_members
   WHERE tenant_id = _tenant_id
     AND user_id = auth.uid()
);
```

### `user_can_read_channel(channel_id)`

Checks channel-level access. The user must be a tenant member AND the channel must be either:
- **tenant-scoped** (visible to everyone in the tenant), OR
- **explicitly listed** in `channel_memberships` for this user's principal

```sql
SELECT EXISTS (
  SELECT 1
    FROM public.channels c
    JOIN public.tenant_memberships tm
      ON tm.tenant_id = c.tenant_id
     AND tm.user_id = auth.uid()
   WHERE c.id = p_channel_id
     AND (
       c.scope = 'tenant'
       OR EXISTS (
         SELECT 1
           FROM public.channel_memberships cm
           JOIN public.principals p ON p.id = cm.principal_id
          WHERE cm.channel_id = c.id
            AND p.user_id = auth.uid()
       )
     )
);
```

---

## The Full Access Chain

```
auth.uid()
    │
    ▼
tenant_memberships  ──►  tenant_id
                              │
                              ▼
                 All tables filtered by:
                 tenant_id = current_tenant_id()
                              │
                              ▼
            Channel-scoped data (l1_events, storage objects)
            also checked via user_can_read_channel()
```

A user can only ever see rows that belong to **their tenant**. Within that, channel-restricted data (WhatsApp messages, meetings, storage files) is further gated by their **channel memberships**.

---

## RLS Policies by Table

| Table | Policy | Rule |
|---|---|---|
| `tenants` | `tenants_member_read` | `is_tenant_member(id)` |
| `tenant_memberships` | `memberships_self_read` | `user_id = auth.uid()` |
| `tenant_members` | `tenant_members_self_read` | `user_id = auth.uid()` |
| `principals` | `principals_tenant_read` | `tenant_id = current_tenant_id()` |
| `channels` | `channels_tenant_read` | `tenant_id = current_tenant_id()` |
| `channel_memberships` | `channel_memberships_self_read` | Self or co-member of same channel |
| `l0_artifacts` | `l0_tenant_read` | `tenant_id = current_tenant_id()` |
| `l1_events` | `l1_events_channel_read` | Tenant member + `user_can_read_channel()` |
| `l1_extraction_runs` | `l1_runs_tenant_read` | `tenant_id = current_tenant_id()` |
| `l1_active_extraction` | `l1_active_tenant_read` | `tenant_id = current_tenant_id()` |
| `l1_embeddings` | `l1_emb_tenant_read` | `tenant_id = current_tenant_id()` |
| `l1_doc_chunks` | `l1_chunks_tenant_read` | `tenant_id = current_tenant_id()` |
| `l2_syntheses` | `l2_tenant_read` | `tenant_id = current_tenant_id()` |
| `l3_surfaces` | `l3_tenant_read` | `tenant_id = current_tenant_id()` |
| `llm_call_log` | `llm_log_tenant_read` | `tenant_id = current_tenant_id()` |
| `whatsapp_devices` | `whatsapp_devices_tenant_read` | `tenant_id = current_tenant_id()` |
| `eval_fixtures` | `eval_fixtures_tenant_read` | `tenant_id = current_tenant_id()` |
| `eval_runs` | `eval_runs_tenant_read` | `tenant_id = current_tenant_id()` |
| `extractor_metadata` | `extractor_metadata_read` | Any authenticated user |
| `l0_source_types` | `l0_source_types_public_read` | Public (no auth required) |

### Storage Bucket Policies (`inbox`, `l0-whatsapp`)

Storage objects are path-scoped. Paths follow the pattern `{tenant_slug}/{channel_identifier}/{...}`. Access is granted when:
1. The user is a tenant member (slug matched via `tenant_memberships`)
2. The channel is readable via `user_can_read_channel()`

---

## Security Warning: Tables Without RLS

Three tables currently have **RLS disabled** — any authenticated user can read/write all rows:

- `public.views`
- `public.view_versions`
- `public.view_drafts`

To fix, enable RLS and add policies:

```sql
ALTER TABLE public.views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.view_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.view_drafts ENABLE ROW LEVEL SECURITY;
```

Policies should be added before enabling RLS, otherwise all access will be blocked.
