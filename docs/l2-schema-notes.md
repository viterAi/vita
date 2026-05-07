# L2 Schema Notes — Vita Supabase

**Last updated:** May 7, 2026  
**Purpose:** Reference for View Builder integration — what data exists, how to read it, how to trace source.

---

## Layer Overview

```
l0_artifacts        raw ingested data        1,974 rows
      ↓
l1_events           extracted events          576 rows
l1_extraction_runs  processing runs            61 rows
      ↓
l2_syntheses        AI-generated syntheses      2 rows (pipeline early)
      ↓
l3_surfaces         ToM-curated outputs         0 rows (not yet running)
```

---

## What's in L0 — Source Types

| source_type | count |
|---|---|
| `whatsapp_message` | 1,273 |
| `whatsapp_message_live` | 341 |
| `whatsapp_attachment` | 296 |
| `claude_code_jsonl` | 59 |
| `meeting_audio` | 5 |

The platform is currently almost entirely **WhatsApp data** — messages, live messages, and attachments — plus some Cursor/Claude agent transcripts and a few meeting recordings.

---

## What's in Channels

| kind | count |
|---|---|
| `whatsapp` | 24 |
| `meeting` | 6 |
| `claude-code` | 5 |
| `email` | 1 |
| `vita-chat` | 1 |

37 channels total. 24 are WhatsApp groups/contacts.

---

## The L2 Table — `l2_syntheses`

### Schema

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `tenant_id` | uuid | Scopes to tenant |
| `scope_kind` | text | What type of scope (e.g. `"day"`, `"channel"`) |
| `scope_key` | text | The specific scope value (e.g. `"2026-04-29"`, a channel UUID) |
| `body` | text | The synthesis content — AI-generated, likely markdown |
| `generator` | text | Which model generated it (e.g. `"claude-opus-4-7"`) |
| `is_stale` | bool | Whether this synthesis needs regenerating |
| `stale_reason` | text | Why it's stale |
| `superseded_by` | uuid | Points to newer synthesis if replaced |
| `cites_event_ids` | uuid[] | Array of `l1_events.id` this synthesis was built from |
| `cites_extraction_runs` | uuid[] | Array of `l1_extraction_runs.id` used |
| `generated_at` | timestamptz | When it was generated |

### Current data (as of May 7, 2026)

2 rows, both with:
- `scope_kind: "day"`
- `scope_key: "2026-04-29"`
- `generator: "claude-opus-4-7"`
- `is_stale: false`
- Body sizes: ~3,385 chars and ~2,796 chars

The only `scope_kind` currently used is `"day"` — a daily synthesis. More scope kinds expected as Mrodchi's pipeline develops.

---

## How to Trace Source from L2

### Path 1 — via `scope_kind` / `scope_key` (fastest, when scope is a channel)

```sql
-- If scope_kind = 'channel', scope_key is a channel UUID
SELECT c.kind, c.identifier, c.display_name
FROM channels c
WHERE c.id = '<scope_key>'::uuid
```

### Path 2 — via `cites_event_ids` (most detailed)

```sql
-- Get source artifacts from cited events
SELECT DISTINCT a.source_type, a.source_uri, a.origin_at
FROM l1_events e
JOIN l0_artifacts a ON a.id = e.artifact_id
WHERE e.id = ANY('<cites_event_ids>'::uuid[])
```

### Path 3 — via channel on the event

```sql
-- Get channels from cited events
SELECT DISTINCT c.kind, c.identifier, c.display_name
FROM l1_events e
JOIN channels c ON c.id = e.channel_id
WHERE e.id = ANY('<cites_event_ids>'::uuid[])
```

---

## What This Means for View Builder

1. **Primary data source:** `l2_syntheses` — query by `tenant_id` + `scope_kind` + `scope_key`
2. **Content format:** `body` is text — likely markdown. The View Builder's Data Analysis skill will parse and interpret it.
3. **Source identification:** use `scope_key` (if it's a channel ID) or traverse `cites_event_ids` → `l1_events` → `l0_artifacts`
4. **First test case:** `scope_kind = "day"` — daily synthesis of WhatsApp activity. This is the first real data to render.
5. **Freshness:** check `is_stale` before rendering; if true, the view should show a stale indicator or trigger a refresh.

---

## Open Questions for Mrodchi

1. What `scope_kind` values will exist beyond `"day"`? (e.g. `"channel"`, `"contact"`, `"topic"`, `"project"`)
2. What is the format of `body`? Always markdown? Structured JSON? Both?
3. Will there be a `scope_kind` per WhatsApp channel, or always rolled up to `"day"`?
4. When will `l3_surfaces` start being populated and what will `surface_key` look like?
