# T-005 — View Persistence: Save / Load / Regenerate

**Wave:** 2 — Core Loop  
**Estimate:** 1 day  
**Depends on:** T-003  
**Blocks:** T-007, T-008

---

## Context

**Implementation status (Gui repo, May 2026):** Persistence is implemented against **`public.views`**, **`view_versions`**, and **`view_drafts`**. Saving/updating specs flows through **`POST /api/views/[viewId]/apply`** (including steer-driven updates). Version snapshots are written on apply / steer-save / restore; **`POST /api/views/[viewId]/restore`** rolls back; **`GET /api/views/[viewId]/versions`** lists history. The Canvas **⋯** menu exposes **Save layout**, **Regenerate from scratch**, and **Version history…** (inline strip). The SQL sketch below is illustrative — use migrations in **`supabase/migrations/`** as source of truth.

**Motivation:** Without persistence, opening a source might regenerate from scratch every time — slow, inconsistent, and expensive. Saved layouts fix that: freeze the spec, refresh data only, and steer or regenerate deliberately.

Views need a lifecycle:
1. AI generates a proposal
2. User steers/refines it
3. User saves it → spec is frozen
4. From now on, view loads the saved spec + fresh data (no AI call)
5. Steer modifications update the saved spec (with versioning)
6. "Regenerate from scratch" is an explicit, intentional action

---

## Scope

Implement view persistence in Supabase. Add save/load/regenerate flows. Implement versioning so users can roll back.

---

## Deliverables

1. Supabase schema migration: `views` table with spec storage, plus `view_versions` for history
2. API endpoints: save view, load view, list versions, rollback to version, regenerate
3. UI: "Save" button on a generated view, "Regenerate" action (explicit), version history panel
4. Loading flow: when a saved view is opened, load spec + fetch fresh data, no AI call

---

## Schema

```sql
-- views: the current state of each saved view
CREATE TABLE views (
  id UUID PRIMARY KEY,
  source_id UUID REFERENCES sources(id),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  spec JSONB NOT NULL,           -- the abstract spec from T-003
  is_default BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL,          -- 'draft' | 'saved' | 'archived'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- view_versions: every save creates a new version
CREATE TABLE view_versions (
  id UUID PRIMARY KEY,
  view_id UUID REFERENCES views(id),
  spec JSONB NOT NULL,           -- snapshot of spec at this version
  change_description TEXT,       -- e.g., "moved chart to top", "added filter"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
```

---

## Behavior Spec

### Saving a view
- User generates a view (status='draft')
- User clicks Save
- View status changes to 'saved'
- A new entry is added to `view_versions`
- The view now loads from the saved spec on subsequent opens

### Loading a saved view
- User opens a saved view
- App fetches the view's spec from `views.spec`
- App fetches fresh data from the source connector
- Mapping layer (from T-003) renders the spec with the data
- NO AI generation call happens

### Regenerating
- User clicks "Regenerate from scratch"
- Confirmation dialog: "This will replace your current view layout. Are you sure?"
- AI generates a new spec
- User can compare to old version and choose to save or discard

### Steer modifications (when T-007 is done)
- User makes a Steer change
- New spec is computed
- View status stays 'saved' but `spec` is updated
- A new version entry is added to `view_versions`

### Version rollback
- User opens version history
- Sees list of versions with timestamps and change descriptions
- Clicks a version → preview
- Clicks "Restore" → that version's spec becomes the current one (and creates a new version entry recording the rollback)

---

## Acceptance Criteria

Use this list as **verification**, not the literal route names from the original sketch.

- [x] Supabase migrations applied: `views` and `view_versions` (and related RLS) exist
- [x] API surface (auth-guarded) — verify in `app/api/views/` and `app/api/sources/[sourceId]/views/`:
  - [x] Load / patch / delete view — `GET` · `PATCH` · `DELETE` **`/api/views/[viewId]`**
  - [x] Apply spec / steer result — **`POST /api/views/[viewId]/apply`**
  - [x] List versions — **`GET /api/views/[viewId]/versions`**
  - [x] Restore — **`POST /api/views/[viewId]/restore`** (body selects target version)
  - [x] Duplicate — **`POST /api/views/[viewId]/duplicate`**
  - [ ] Dedicated **`POST /api/views/[id]/regenerate`** (optional — regeneration may stay coupled to the canvas generation flow + explicit UI action)
- [x] UI: Save layout + Regenerate + Version history — **`app/components/TabBar.tsx`** (Canvas ⋯ menu) + restore actions in history strip
- [x] Saved views reload **without** full AI regeneration (steer excepted)
- [x] Fresh **L2 / channel** data on load and refresh paths — see **`useCanvas`** + `/api/sources/[sourceId]/canvas`
- [x] Material spec changes create **`view_versions`** rows (initial row on view create)
- [x] Restore updates current spec and records the rollback in history

---

## Notes for the Agent

- Use Supabase Row Level Security: users can only see/modify their own views
- The spec is stored as JSONB — no need to flatten it
- Don't worry about diffing in the version history UI — just show "version N from [date]" with the change description. Diff visualization is a future enhancement.
- The "change description" is auto-generated for now: "Saved" for first save, "Updated via Steer" for Steer changes, "Manual edit" for direct spec edits, "Restored from version N" for rollbacks.
