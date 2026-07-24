# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through
[GitHub private vulnerability reporting](https://github.com/shuntaroy/HeaRT-LLM/security/advisories/new).
If that route is unavailable, contact Shuntaro Yada.

Do not include clinical or participant-derived text, API keys, access tokens,
raw model responses, or other sensitive payloads. Use synthetic placeholders
and redact request and response bodies. If sensitive data has already been
exposed, say what category of data was involved without copying it into the
report.

Please allow time for acknowledgement and remediation before public
disclosure. This research prototype is not a medical device and must not be
used as the sole basis for clinical decisions.

## Supported version

Security fixes target the current `main` branch and the Worker deployed at
<https://heart.shntryd.workers.dev>. Older commits and deployments are not
supported.
