# View Builder — Platform Integration Plan

**Author:** Issac Brown  
**Last updated:** May 7, 2026  
**Status:** Draft — pending review and sign-off from Mrodchi  
**Blocks:** checklist items 1.4, 1.5 ⚡

---

## Purpose

This document defines how the View Builder integrates with the broader platform. It is a shared contract between the View Builder (Issac) and Mrodchi (platform data + intelligence layer). Both sides must agree on this before either side builds against the interface.

---

## What the View Builder Is (and Isn't)

The View Builder is a **pure rendering layer**. It receives data and intent, generates a view spec, and renders it. It does not own auth, data collection, user intelligence, or agent memory.

Everything else — auth, data ingestion, surfacing logic, ToM, agent memory — is owned by Mrodchi.

---

## Platform Architecture

The platform has three permanent layers. The View Builder produces output for the **surface** layer only.

```
┌─────────────────────────────────────────┐
│  Murmur (top)                           │  ← ambient stream, ToM-curated
│  one-line summaries / counts / alerts   │
├─────────────────────────────────────────┤
│  Surface (center)                       │  ← VIEW BUILDER OUTPUT LIVES HERE
│  generated views, weighted cards        │
├─────────────────────────────────────────┤
│  Dock (bottom)                          │  ← Mrodchi owns this
│  conversational layer, always present   │
└─────────────────────────────────────────┘
```

---

## Ownership Boundaries

| Concern | Owner |
|---------|-------|
| Shell chrome (murmur / surface / dock layout) | Platform shell |
| Auth, user identity, permissions | Supabase (RLS) |
| Data ingestion, source connectors | Mrodchi |
| User intelligence, ToM, preferences | Mrodchi |
| Dock chat UI | Platform shell |
| Deciding view type + intent from user message | Mrodchi |
| Spec composition (how to render a view) | View Builder |
| Component library, skills, rendering rules | View Builder |
| Spec storage and versioning | View Builder (Supabase `views` table) |
| Design tokens | View Builder (fetched from Supabase by tenant/user) |
| Spec schema and format | View Builder owns the view layer; data field schema is a shared contract |

---

## Data Flow

### How data reaches the View Builder

There is no payload handshake between Mrodchi and the View Builder. The View Builder reads directly from Mrodchi's **L2 Supabase tables**. Mrodchi writes to those tables — the View Builder reads from them. No data is passed between systems at request time.

```
Mrodchi → writes → L2 Supabase tables
                        ↓
              View Builder reads directly
                        ↓
                   Renders view
```

The contract between Mrodchi and the View Builder is the **L2 table schema** — what tables exist, what columns they have, and what the data means semantically.

**Open question for Mrodchi:** what are the L2 tables and their schemas? The View Builder needs this to build the Data Analysis and Spec Composition skills correctly.

---

## View Generation Flow

### Case 1 — No saved spec (first time)

```
User opens source / requests view
  → Mrodchi: understands intent + context → picks view_type → passes intent to View Builder
  → View Builder: reads L2 Supabase tables → composes spec using view-type skill → renders
  → Surface: displays view (ephemeral — not saved yet)
  → User: steers or says "save this"
  → View Builder: writes spec to Supabase views table
```

### Case 2 — Saved spec exists

```
User opens source
  → View Builder: loads spec from Supabase views table
  → View Builder: fetches fresh data via Supabase
  → Surface: renders (no AI call, no Mrodchi involvement)
```

---

## Steer Loop (View Refinement)

When the user modifies a view via the dock, message routing splits three ways:

| Message type | Example | Handler |
|---|---|---|
| Pure UI change | "move the chart to the top" | View Builder handles directly — no external call |
| Needs data | "show only overdue invoices" | View Builder calls Mrodchi's MCP server → gets data → re-renders |
| Persistent preference | "this client is important" | View Builder calls Mrodchi's MCP server → Mrodchi updates ToM |

All communication with Mrodchi goes through his MCP server. The View Builder calls it when it needs data or needs to pass on a preference. Mrodchi decides what to do from there.

---

## How Skills Work

Skills are `SKILL.md` files that encode the rules the AI follows when generating views. They are not prompts buried in code — they are readable files, version-controlled in the repo, that any agent (or human) can inspect and update.

### Generation pipeline

When a view is requested, skills chain in this order:

```
Intent + data payload (from Mrodchi)
  → Data Analysis skill        what does this data actually mean semantically?
  → Spec Composition skill     which view type? what emphasis? which skill to invoke?
  → View-Type skill            how to lay it out, which components, which rules apply
  → Spec Validation skill      does the generated spec follow the rules?
  → Renderer                   build the HTML/component bundle
```

### Pipeline skills (run every generation)

| Skill | Role |
|---|---|
| **Data Analysis** | Goes from structural ("this is a table with 3 rows") to semantic ("these are overdue invoices needing approval by Friday"). Feeds meaning into the spec. |
| **Spec Composition** | Decides which view-type skill to invoke based on data semantics + Mrodchi's intent. Handles ambiguous cases. |
| **Spec Validation** | Checks the generated spec against the rules of its view type before rendering. Catches bad field references, missing components, rule violations. |
| **Eval** | Offline only — runs AI generation against golden test cases, scores pass/fail per rule. Not part of live generation. |

### View-type skills (one invoked per generation)

| Skill | When invoked | Key rules |
|---|---|---|
| **Spatial View** | Dashboards, boards, monitoring | F-pattern layout, ≤12 KPIs, 5-second comprehension, chart type matching |
| **Sequential View** | Triage queues, checklists, approval flows | One item at a time, ≤4 action buttons, progress visibility, escape hatches |
| **Briefing View** | Digests, summaries, catch-up surfaces | Time-bounded framing, prioritization hierarchy, "you're caught up" completion signal |
| **Weighted Card View** | Home surface | Enough context per card to decide without opening, priority-driven sizing, progressive disclosure |
| **Configuration View** | Source config, flow boards, permissions | Stable layout, drag-and-drop blocks, authorize/confirm pattern |

### Skills and the integration boundary

Skills are internal to the View Builder. Mrodchi does not invoke skills directly — he passes `view_type` + intent in the handshake payload, and the View Builder's Spec Composition skill decides which view-type skill to run. Mrodchi never needs to know which skill ran or what rules it applied.

---

## Spec Persistence

- Generated views are **ephemeral by default**
- User must explicitly say "save this" to persist
- On save: View Builder writes spec to `views` table in Supabase
- Each subsequent Steer change that modifies the layout creates a new version entry
- User can roll back to a previous version

---

## Auth

Auth is handled entirely by Supabase. The View Builder reads the active Supabase session at render time. Row-level security on the `views` table enforces permissions. Mrodchi does not pass auth context — it is never in the handshake payload.

---

## Action Routing (OPEN — to be decided)

When a user takes an action inside a generated view (clicks a button, submits a form):

| Action type | Handler |
|---|---|
| Ephemeral filter / UI-only | View Builder (in-memory) — no external call |
| Persistent write-back to source | To be decided with Mrodchi |
| Agent-triggering action | Calls Mrodchi's MCP server |

**Boundary-crossing actions (write-back, agent-triggering) are logged to a Supabase `events` table.** Whether pure UI interactions should also be logged is an open question for the joint session.

---

## Multi-View Model

Multiple views per source are supported — tabs, add, rename, reorder, duplicate, delete, set default, composed mode (views side by side). This is entirely internal to the View Builder. Mrodchi does not manage tabs.

If Mrodchi needs to know what views exist for a source, he can query the `views` table in Supabase directly using `source_id`. Suggestion to raise in the joint session.

---

## Static vs. Dynamic Components

The spec marks each component with a `mode` field:
- `mode: "static"` — data refreshes, structure doesn't change
- `mode: "dynamic"` — can be swapped/updated based on triggers (e.g. `data_change`, `agent_event`)

The View Builder infers volatility from the L2 table schema — which columns are live feeds vs. snapshots. This is determined when the View Builder reads the table, not passed by Mrodchi. The exact inference rules are an internal View Builder concern.

---

## Design Tokens

Components accept design tokens as parameters from day one (not hardcoded styles). Tokens are fetched from Supabase by the View Builder based on tenant/user context. Mrodchi never passes tokens — they are entirely internal to the View Builder's rendering layer.

Token schema: `primary_color`, `secondary_color`, `font_family`, `card_radius`, `button_style`, `table_density`. Full token support is Month 3+ but components are built to accept them from the start.

---

## MCP Apps (Future — Month 3+)

From Month 3, the View Builder will produce **self-contained HTML bundles** delivered via the MCP Apps protocol, renderable in Claude, ChatGPT, WhatsApp, and email from the same spec.

The handshake payload between Mrodchi and the View Builder will not change — Mrodchi passes intent + data, the View Builder changes what it produces under the hood. Mrodchi should be aware this migration is coming and avoid building hard dependencies on the current rendering format.

---

## What Stays Local Until This Plan Is Approved

- The app runs locally only — no Railway deployment (already taken offline ✓)
- No new source connectors built until data handshake schema is confirmed
- No write-back implementation until action routing is decided

---

## Open Questions (For Mrodchi)

1. **L2 table schema** — what tables exist, what columns, what does each field mean semantically? This is the core contract the View Builder builds against.
2. **Action routing** — how do persistent write-back and agent-triggering actions get routed?
3. **Action logging scope** — log boundary-crossing actions only, or all UI interactions?
4. **Edge Function ownership** — who maintains the Supabase Edge Function that serves data to the View Builder?
5. **View type decision** — does Mrodchi always decide `view_type`, or can the View Builder suggest one if Mrodchi doesn't specify?
6. **MCP data agent interface** — what does the View Builder call, with what arguments, when it needs additional data mid-steer?
7. **Multi-view visibility** — should Mrodchi query the `views` table directly, or does the View Builder expose an endpoint?

---

## Next Steps

- [ ] Share this doc with Mrodchi for review
- [ ] Resolve open questions (joint session)
- [ ] Get L2 table schema from Mrodchi — this is the core contract
- [ ] Finalize action routing decision
- [ ] Mark integration plan approved → unblocks spec format work and shell build
