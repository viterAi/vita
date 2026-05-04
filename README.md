# vita

The Vita platform — TypeScript monorepo per `00-stack-decision.pdf` (2026-05-03).

## Layout

```
apps/
  web/                 Next.js 16 + React 19 + Tailwind v4 → Vercel

packages/
  spec/                JSON Schema → typed manifest contract (npm publishable)
  runtime/             dispatch · audit · policy · sign         → Railway
  orchestrator/        agent loop · planning · streaming         → Railway
  ontology/            MD axioms compiled to TS exports          (consumed in-place)
  ui/                  shadcn-style primitives for spaces        (consumed in-place)

manifests/             versioned plunet/0.1.0.yaml, xero/0.1.0.yaml, …

adapters/              http · browser (Playwright) · desktop · hil · mcp  → Railway

infra/
  supabase/            migrations · seed · edge functions
```

## Hosting

| Service                              | Where                 | Why                                                    |
|--------------------------------------|-----------------------|--------------------------------------------------------|
| `viter.ai` (Next.js UI)              | Vercel                | Edge cache · per-branch previews                       |
| `api.viter.ai` (chat streaming)      | Vercel Functions Fluid| 800s SSE · `waitUntil()` for post-response             |
| `substrate.viter.ai` (runtime + adapters) | Railway          | Always-on · no timeout · warm Playwright               |
| Data (manifests · audit · chat · wiki · finance) | Supabase us-west-1 | One Postgres · RLS multi-tenant            |

## Supabase project

- Project ref: `dkccadwohifcqcdzhhnu`
- Region: `us-west-1`
- Org: `devteam@viter.ai`
- URL: `https://dkccadwohifcqcdzhhnu.supabase.co`

## Companion repos

- `viterAi/viter` — recon prod (Insperanto / Jeffrey). **Stays.**
- `viterAi/viter-ontology` — worldview spec. Consumed by `packages/ontology/`.
- `viterAi/Knowledge-Agent` — Yitzchak's Python/FastAPI. Ports to `packages/orchestrator/`.

## Status

v0.1 scaffold — created 2026-05-04 in response to Code Red.
