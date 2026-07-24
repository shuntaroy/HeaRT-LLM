# Contributing

HeaRT-LLM is a research prototype. Contributions should preserve the boundary
between probabilistic PRISM annotation, deterministic temporal inference, API
handling, and presentation.

## Safety requirements

- Use only synthetic or already-published text in tests and documentation.
- Do not commit participant-derived, confidential, or identifying clinical
  text.
- Do not log or persist source text, API keys, or raw model responses.
- Keep live model calls outside automated tests and disabled unless
  `HEART_ALLOW_LIVE_LLM=true`.
- Treat timeline correctness as a research claim: distinguish extracted facts,
  deterministic inferences, warnings, and unresolved uncertainty.

## Development

Use Node.js 24 through `mise` and use `npm` as the package manager.

```zsh
mise run setup
mise run check
```

The complete gate must pass before a pull request is ready for review.
