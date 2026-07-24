# Architecture

## System boundary

HeaRT-LLM accepts one Japanese clinical document and an optional document
creation date. It extracts PRISM annotations through an OpenAI-compatible model
provider, validates the returned evidence, applies deterministic temporal
inference, and renders a timeline beside the source text.

```text
browser
  ├── React interface
  ├── source text and optional document date
  └── request-scoped OpenRouter key
                    │
                    ▼
same-origin Cloudflare Worker
  ├── request policy
  ├── PRISM annotation adapter
  ├── deterministic temporal inference
  └── TimelineDocument 1.0
                    │
                    ▼
OpenRouter and the selected model provider
```

The Worker and static assets deploy as one unit. `/api/*` executes the Worker;
other routes use the static asset binding and single-page-application fallback.

## Module boundaries

- `web/worker/annotation` owns prompt construction, provider transport, TANL
  parsing, relation parsing, and annotation validation.
- `web/worker/timeline` owns deterministic date normalisation, graph
  validation, temporal ordering, interval construction, conflicts, and
  unplaced evidence.
- `web/shared` defines the versioned presentation-independent
  `TimelineDocument` contract.
- `web/src` derives interface layout and interaction from that contract.

Provider transport does not enter the deterministic inference module, and the
Worker does not return presentation-coupled HTML or recursively embedded domain
objects.

## Request and progress model

`POST /api/timelines/stream` returns request-local NDJSON. It reports completion
of the entity, medical-relation, and temporal-relation phases before returning
the final timeline. Progress never advances from elapsed time or a simulated
percentage.

The request is stateless. There is no run table, polling record, queue, or
server-side analysis history.

## Deterministic inference

The inference engine:

1. validates source spans, relation endpoints, and supported label combinations;
2. normalises only supported dates while retaining their precision;
3. resolves relative expressions only when an explicit document date supports
   the rule;
4. groups explicit `timeOn` equivalence and orders supported before/after
   constraints;
5. constructs point, closed, and one-sided interval placements;
6. preserves conflicting candidates and their evidence; and
7. retains clinically relevant evidence that cannot be placed.

A missing temporal bound remains missing. Presentation code cannot convert
uncertainty into an exact date.

## Deployment

The production Wrangler environment uses the Worker name `heart` and deploys to
<https://heart.shntryd.workers.dev>.

```zsh
npm --prefix web run deploy:production
npm --prefix web run smoke:production
```

The deployment smoke makes no provider call. It verifies health metadata,
no-store behaviour, browser security headers, the Japanese default, keyless
rejection, and safe unknown-route errors.
