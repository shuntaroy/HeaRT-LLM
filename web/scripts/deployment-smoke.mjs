const baseUrl = new URL(
  process.argv[2] ??
    process.env.HEART_DEPLOYMENT_URL ??
    "https://heart-preview.shntryd.workers.dev",
);
const syntheticMarker = "synthetic-deployment-smoke-marker";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function responseText(response) {
  const text = await response.text();
  assert(
    !text.includes(syntheticMarker),
    `${response.url} reflected request text in an error response.`,
  );
  return text;
}

async function main() {
  assert(baseUrl.protocol === "https:", "Deployment smoke tests require an HTTPS URL.");

  const healthResponse = await fetch(new URL("/api/health", baseUrl), {
    headers: { Accept: "application/json" },
  });
  assert(healthResponse.status === 200, `Health check returned HTTP ${healthResponse.status}.`);
  assert(
    healthResponse.headers.get("cache-control") === "no-store, max-age=0",
    "Health response is missing the no-store policy.",
  );
  const health = await healthResponse.json();
  assert(health.status === "ok", "Health response did not report ok.");
  assert(health.version === "1.0.0", "Health response reported an unexpected version.");
  assert(health.runtime === "cloudflare-worker", "Health response reported an unexpected runtime.");
  assert(health.requires_user_api_key === true, "Deployment does not require a user API key.");

  const rootResponse = await fetch(baseUrl);
  assert(rootResponse.status === 200, `Application root returned HTTP ${rootResponse.status}.`);
  assert(
    rootResponse.headers.get("content-security-policy")?.includes("connect-src 'self'"),
    "Application root is missing the expected Content Security Policy.",
  );
  assert(
    rootResponse.headers.get("permissions-policy") ===
      "camera=(), geolocation=(), microphone=()",
    "Application root is missing the expected Permissions Policy.",
  );
  assert(
    rootResponse.headers.get("referrer-policy") === "no-referrer",
    "Application root is missing the expected Referrer Policy.",
  );
  const html = await rootResponse.text();
  assert(html.includes('<html lang="ja">'), "Application root does not default to Japanese.");

  const keylessResponse = await fetch(new URL("/api/timelines", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: syntheticMarker }),
  });
  assert(keylessResponse.status === 401, `Keyless analysis returned HTTP ${keylessResponse.status}.`);
  const keylessText = await responseText(keylessResponse);
  const keyless = JSON.parse(keylessText);
  assert(keyless.detail?.code === "missing-api-key", "Keyless analysis returned an unexpected error.");

  const missingResponse = await fetch(new URL("/api/not-a-route", baseUrl));
  assert(missingResponse.status === 404, `Unknown API route returned HTTP ${missingResponse.status}.`);
  await responseText(missingResponse);

  console.log(
    JSON.stringify(
      {
        status: "passed",
        url: baseUrl.origin,
        runtime: health.runtime,
        version: health.version,
        checks: [
          "health",
          "no-store",
          "security-headers",
          "japanese-default",
          "keyless-rejection",
          "safe-api-error",
        ],
      },
      null,
      2,
    ),
  );
}

await main();
