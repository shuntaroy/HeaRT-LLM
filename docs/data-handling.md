# Data handling and security

## Scope

This document describes HeaRT-LLM's application-level design. It does not
guarantee the behaviour of infrastructure operated by Cloudflare, OpenRouter,
or another model provider. Their processing, logging, retention, jurisdiction,
and security policies also apply.

HeaRT-LLM is an exploratory research prototype, not a medical device. The
deployed service is not approved for participant-derived, confidential, or
identifying clinical text.

## Request data flow

The browser holds the source text, optional document date, selected model, and
user-supplied OpenRouter key in React memory. For an analysis, it sends them to
the same-origin Worker over HTTPS. The key is carried in the
`X-HeaRT-OpenRouter-Key` request header and is not placed in a URL, JSON body,
response, cookie, `localStorage`, or `sessionStorage`.

The Worker validates request bounds, sends the provider request to OpenRouter,
validates the returned annotation, applies deterministic inference, and returns
a no-store NDJSON response. It has no shared provider credential or persistent
storage binding.

Reloading or closing the page, or selecting **Clear page memory**, discards the
browser state. The application does not create a database record, queue,
object-store entry, run directory, or application log for an analysis.

## Application controls

- API responses set `Cache-Control: no-store`, `Pragma: no-cache`, and
  `X-Content-Type-Options: nosniff`.
- Worker logs, invocation logs, traces, and persistence are disabled in the
  checked Wrangler configuration.
- The browser uses no analytics, third-party scripts, service worker, cookie,
  or ambient credential; API requests use `credentials: "omit"`.
- A restrictive Content Security Policy and related browser headers limit the
  origins that can execute code or receive data.
- Input length, model-identifier length, provider-output size, timeout, and
  retry count are bounded.
- Exact source reconstruction and relation endpoints are validated before a
  timeline is accepted. Provider errors do not return raw model content.
- Automated tests use fakes and synthetic fixtures.

## Residual risks

| Threat | Current control | Residual risk |
| --- | --- | --- |
| User-key disclosure | Memory-only handling, same-origin header, restrictive CSP, no application logging | Browser extensions, a compromised device, Cloudflare, and the provider remain outside the application's control |
| Source or result retention | No application persistence, no-store responses, disabled Worker observability | Network and provider systems may process or retain requests under their own policies |
| Malformed model output | Strict parsers, source reconstruction, endpoint validation, escaped React output | A syntactically valid timeline may still be factually wrong |
| Public endpoint abuse | User-provided keys, no shared model budget, bounded requests | The Worker can still receive unwanted traffic; no rate limiter or Turnstile is currently deployed |
| Clinical misuse | Research warning, visible uncertainty, human-review requirement | Interface warnings cannot prevent inappropriate downstream use |

It is accurate to say that the checked application is designed not to persist
source text, results, or user keys at the application layer. It is not accurate
to claim that no data is retained anywhere.
