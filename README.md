# HeaRT-LLM

HeaRT-LLM is an exploratory research prototype for turning Japanese clinical
text into an evidence-linked patient timeline. It combines an LLM-based PRISM
annotation adapter with deterministic temporal inference and an interactive
React interface.

Try the deployed application at <https://heart.shntryd.workers.dev>.

> [!IMPORTANT]
> HeaRT-LLM is not a medical device. Its output requires human review and must
> not be used as the sole basis for a clinical decision. Do not submit
> participant-derived, confidential, or identifying clinical text to the
> deployed service or another external model provider.

## What it does

- extracts PRISM entities, medical relations, and temporal relations;
- validates exact source spans and relation endpoints;
- places supported point events, intervals, and partial temporal orderings;
- preserves contradictions, uncertainty, and unplaced evidence as warnings;
- links timeline items back to their supporting source text; and
- exports the presentation-independent `TimelineDocument 1.0` JSON contract.

Progress reports only actually completed PRISM phases. Probabilistic annotation,
deterministic inference, the API boundary, and presentation remain separate
modules.

## Architecture

The React application and same-origin API are deployed together as one
Cloudflare Worker:

```text
browser
  └── source text + optional document date + request-scoped provider key
          │
          ▼
Cloudflare Worker
  ├── request policy and PRISM annotation
  ├── deterministic temporal inference
  └── no-store TimelineDocument response
          │
          ▼
OpenRouter and the user-selected model provider
```

The application has no database, object storage, queue, analytics, or shared
provider credential. Source text, results, and the user key exist only in
browser or request memory at the application layer. Cloudflare, OpenRouter, and
the selected model provider still process requests under their own policies.
See [Architecture](docs/architecture.md) and
[Data handling and security](docs/data-handling.md).

## Repository layout

```text
web/src/            React interface
web/worker/         Cloudflare Worker API, PRISM adapter, and inference
web/shared/         Versioned presentation-independent contract
web/scripts/        Deployment and synthetic live-smoke commands
docs/               Public architecture and data-handling documentation
```

## Local development

Node.js 24 is managed through `mise`; dependencies use `npm`.

```zsh
mise run setup
mise run dev
```

Run the complete offline quality gate with:

```zsh
mise run check
```

The gate checks generated Worker bindings, TypeScript compilation, React and
Worker tests, synthetic deterministic fixtures, and both review and production
builds. Automated tests do not call a model provider.

## Controlled live testing

Live calls are disabled by default. The live-smoke command uses only its
built-in synthetic Japanese example and a local key:

```zsh
cp .env.example .env
# Add HEART_SMOKE_OPENROUTER_API_KEY to .env
HEART_SMOKE_MODEL=openai/gpt-5.6-sol npm --prefix web run smoke:live
```

The command does not print the source text, API key, or raw model response. A
successful smoke test demonstrates transport and contract handling for one
synthetic input; it is not an accuracy or clinical-utility evaluation.

## Licence, provenance, and security

HeaRT-LLM is distributed under the [MIT License](LICENSE). Copied and adapted
upstream material is identified in
[Third-party notices](THIRD_PARTY_NOTICES.md). The software licence and the
descriptive [patent reference](PATENTS.md) are recorded separately.

Please report vulnerabilities privately as described in
[the security policy](SECURITY.md), without including clinical text, API keys,
or raw model responses.

## Reference

Yada, S. and Aramaki, E. (2023).
[HeaRT: Health Record Timeliner to visualise patients' medical history from
health record text](https://arxiv.org/abs/2306.14379).
