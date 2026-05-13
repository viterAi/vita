# T-008 — Multi-View Model: Tabs, Add, Rename, Delete

**Wave:** 2 — Core Loop  
**Estimate:** 1 day  
**Depends on:** T-005  
**Blocks:** Composed mode work in T-018+

---

## Context

**Implementation status (Gui repo, May 2026):** Multiple saved layouts per source use **`sort_order`**, **`PATCH`** updates, and **`POST /api/sources/[sourceId]/views/reorder`**. The **`TabBar`** shows compact rows for source (**SRC**), layouts (**LYT** pills + **+**), optional **2-up** compare (reference pane read-only; steer still targets primary only — [`CHECKLIST.md`](../../CHECKLIST.md) §6), and **PG** page strips. Rename / duplicate / delete / default / reorder are in the layout **⚙** menu (rename uses a browser prompt, not double-click tabs). Per-view steer transcript is stored in **`views.ui_state.steer_messages`** and persisted when switching layouts / after steer-save (**`useCanvas`**). **Drag-and-drop tab reorder is not implemented** — **Move left / Move right** menu actions persist order instead.

A single source can have multiple views. A user might want their Xero source to have:
- An "Aging Overview" dashboard (spatial)
- A "Triage" sequential view for invoices needing attention
- A "Pipeline" board view

Each view is independent — its own spec, its own steer history, its own state — but they share the underlying data and connectors.

This ticket implements the view collection per source and the UI for managing it.

---

## Scope

Build the view collection model. Add tab UI for switching between views. Implement add/rename/delete/duplicate/set-default. Each view gets its own dock thread (multi-thread support).

---

## Deliverables

1. Tab UI in the source header showing all views
2. "Add View" button that triggers generation with a prompt for what kind of view
3. View management actions: rename (inline edit on tab), delete (with confirmation), duplicate, set as default
4. Multi-thread dock: switching views switches the dock context to that view's thread
5. Default view logic: opening a source loads the default view (first view if no explicit default set)

---

## Behavior Spec

### Adding a view
- User clicks "+ Add View" in the source's view tab bar
- Modal or inline prompt: "What kind of view?" with options or free text
- User describes the view (or picks a template)
- Agent generates a spec, saves it as a new view (status='draft')
- Tab appears in the bar, view becomes active
- User can refine via dock, then save

### Renaming
- Double-click a tab → inline edit
- Or right-click → context menu → Rename
- Enter to confirm, Esc to cancel
- View's `name` field is updated in Supabase

### Deleting
- Right-click a tab → Delete
- Confirmation: "Delete '[view name]'? This cannot be undone."
- View is hard-deleted (or soft-deleted with `status='archived'` — pick one and document)
- If the deleted view was the default, the next view in order becomes default
- If it was the last view, source goes back to "no views" state

### Duplicating
- Right-click a tab → Duplicate
- Copies the spec exactly to a new view named "[Original name] (copy)"
- New view is a draft until user saves explicitly

### Setting default
- Right-click a tab → Set as default
- Updates `is_default = true` on this view, `false` on all others for this source
- When source is opened next, this view loads first

### Switching between views
- User clicks a tab → that view loads
- Dock context switches: the conversation history for that view's thread becomes active
- Previously active view's thread is preserved but hidden

---

## Multi-Thread Dock

The dock now needs to maintain a separate conversation thread per view:

```typescript
interface DockThread {
  view_id: string;
  messages: Message[];
  created_at: string;
}
```

- When the user switches views, the dock loads that view's thread
- New messages are appended to the active view's thread
- If the user switches away mid-typing, the draft message is preserved with the original thread

---

## Acceptance Criteria

- [x] Layout strip renders all saved views for the current source (`TabBar` **LYT** row)
- [x] **+** creates a new layout (generation + save flow — wording differs from “Add View” modal in ticket)
- [ ] Inline rename (double-click tab) — **not implemented**; rename via **⚙ → Rename…** prompt
- [x] Delete works with confirmation (menu + confirm dialog)
- [x] Duplicate layout (API + menu)
- [x] Set as default — persisted as **`is_default`** / **★** marker in UI
- [x] Default vs first layout selection when opening a source — **`useCanvas`** / bootstrap behavior
- [x] Steer messages scoped per layout — **`ui_state.steer_messages`** persisted on switch / steer-save
- [ ] Draft **dock input** preserved when switching views — verify explicitly (not guaranteed by transcript persistence alone)
- [ ] Drag-and-drop reorder — **deferred**; **`sort_order`** + **Move left / right** implemented instead
- [ ] Dedicated zero-layout empty state with single CTA — confirm vs generic canvas empty states (tracked in [`CHECKLIST.md`](../../CHECKLIST.md) if gaps remain)

### Composed / compare mode

- [x] **2-up** split with selectable reference layout — primary editable; reference read-only ([`CHECKLIST.md`](../../CHECKLIST.md) §6 last bullet)
- [ ] Independently steerable secondary pane — **explicitly deferred**

---

## Notes for the Agent

- **Order:** Repo uses **`sort_order`** + **`POST …/views/reorder`** + menu-driven **Move left / right**, not `@dnd-kit` drag tabs — align future work with [`CHECKLIST.md`](../../CHECKLIST.md) §6 before adding DnD.
- Rename uses **`window.prompt`** today — upgrading to inline edit is optional UX polish.
- The "+ layout" flow triggers canvas generation — prompt richness can still match the ticket’s suggestions (“Dashboard,” “Triage queue,” …) without blocking persistence.
- **Overflow:** Layout pills wrap within **`TabBar`**; horizontal scroll applies mainly to **PG** page titles.
- **Compare:** **2-up** split ships read-only reference pane; dual steer remains deferred ([`CHECKLIST.md`](../../CHECKLIST.md) §6).
