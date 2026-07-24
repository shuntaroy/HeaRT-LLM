import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleApiRequest, handleRequest } from "./index";

const fetchAsset = vi.fn<(request: Request) => Promise<Response>>();
const env = {
  ASSETS: { fetch: fetchAsset },
  HEART_ENVIRONMENT: "preview",
  HEART_ALLOW_LIVE_LLM: "false",
  HEART_MAX_INPUT_CHARS: "20000",
  HEART_LLM_TIMEOUT_MS: "120000",
  HEART_LLM_MAX_RETRIES: "1",
  HEART_MAX_OUTPUT_TOKENS: "16384",
  OPENROUTER_MODEL: "openai/gpt-5-mini",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
} as unknown as Env;
const userKeyEnv = {
  ...env,
  HEART_ALLOW_LIVE_LLM: "true",
  OPENROUTER_MODEL: "openai/gpt-5.6-sol",
} as unknown as Env;
const ctx = { waitUntil: vi.fn() };

describe("Cloudflare Worker boundary", () => {
  beforeEach(() => {
    fetchAsset.mockReset();
    ctx.waitUntil.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a safely disabled analysis runtime", async () => {
    const response = await handleApiRequest(new Request("https://example.test/api/health"), env, ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      runtime: "cloudflare-worker",
      analysis_available: false,
    });
  });

  it("honours the explicit live-call gate", async () => {
    const response = await handleApiRequest(
      new Request("https://example.test/api/timelines/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "synthetic text" }),
      }),
      env,
      ctx,
    );

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("synthetic text");
  });

  it("reports BYOK-only live analysis", async () => {
    const response = await handleApiRequest(new Request("https://example.test/api/health"), userKeyEnv, ctx);

    await expect(response.json()).resolves.toMatchObject({
      live_llm_enabled: true,
      requires_user_api_key: true,
      analysis_available: true,
    });
  });

  it("requires a user key before reading an enabled analysis request", async () => {
    const response = await handleApiRequest(
      new Request("https://example.test/api/timelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "synthetic private marker" }),
      }),
      userKeyEnv,
      ctx,
    );

    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("synthetic private marker");
  });

  it("allows any user-key model and never echoes the credential", async () => {
    const providerFetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", providerFetch);
    const apiKey = "synthetic-user-api-key";

    const response = await handleApiRequest(
      new Request("https://example.test/api/timelines", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-HeaRT-OpenRouter-Key": apiKey,
        },
        body: JSON.stringify({
          text: "synthetic text",
          model: "  provider/model-available-to-user-key  ",
        }),
      }),
      userKeyEnv,
      ctx,
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      detail: {
        code: "provider-authentication-failed",
        message: "OpenRouter rejected the API key.",
      },
    });
    const providerInit = providerFetch.mock.calls[0]?.[1] as RequestInit;
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(new Headers(providerInit.headers).get("Authorization")).toBe(`Bearer ${apiKey}`);
    expect(JSON.stringify(providerInit.body)).not.toContain(apiKey);
    expect(JSON.parse(String(providerInit.body))).toMatchObject({
      model: "provider/model-available-to-user-key",
    });
  });

  it("streams each completed PRISM phase before the frozen synthetic result", async () => {
    const outputs = [
      "[2024年1月10日 | TIMEX3(DATE)]に[受診 | cc(+)]した。",
      "(なし)",
      "timeOn: e2 -> e1",
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          choices: [{ message: { content: outputs.shift() } }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            total_tokens: 120,
            cost: 0.0001,
          },
        }),
      ),
    );

    const response = await handleApiRequest(
      new Request("https://example.test/api/timelines/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-HeaRT-OpenRouter-Key": "synthetic-user-api-key",
        },
        body: JSON.stringify({
          text: "2024年1月10日に受診した。",
          dct: "2024-01-10",
          model: "openai/gpt-5.6-sol",
        }),
      }),
      userKeyEnv,
      ctx,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(events.slice(0, 3)).toEqual([
      { type: "progress", phase: "entity", completed: 1, total: 3 },
      { type: "progress", phase: "medical_relation", completed: 2, total: 3 },
      { type: "progress", phase: "time_relation", completed: 3, total: 3 },
    ]);
    expect(events[3]).toMatchObject({
      type: "result",
      timeline: {
        run: { persistence: "none", phase_calls: 3 },
        items: [{ placement: { status: "point" } }],
      },
    });
    expect(JSON.stringify(events)).not.toContain("synthetic-user-api-key");
  });

  it.each([
    {
      name: "rejects a non-JSON request",
      headers: { "Content-Type": "text/plain" },
      body: "synthetic",
      status: 415,
      code: "unsupported-media-type",
    },
    {
      name: "rejects unsupported fields",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "synthetic", unsupported: true }),
      status: 422,
      code: "unexpected-field",
    },
    {
      name: "rejects an invalid document creation date",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "synthetic", dct: "2026-02-30" }),
      status: 422,
      code: "invalid-dct",
    },
  ])("$name", async ({ headers, body, status, code }) => {
    const response = await handleApiRequest(
      new Request("https://example.test/api/timelines", {
        method: "POST",
        headers: {
          ...headers,
          "X-HeaRT-OpenRouter-Key": "synthetic-user-api-key",
        },
        body,
      }),
      userKeyEnv,
      ctx,
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ detail: { code } });
  });

  it("delegates non-API requests to the static asset binding", async () => {
    fetchAsset.mockResolvedValue(new Response("asset"));
    const request = new Request("https://example.test/");

    const response = await handleRequest(request, env, ctx);

    expect(fetchAsset).toHaveBeenCalledWith(request);
    await expect(response.text()).resolves.toBe("asset");
  });

  it("answers asset HEAD probes with GET metadata and no body", async () => {
    fetchAsset.mockResolvedValue(
      new Response("asset", { headers: { "Content-Type": "text/html" } }),
    );

    const response = await handleRequest(
      new Request("https://example.test/", { method: "HEAD" }),
      env,
      ctx,
    );

    expect(fetchAsset).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html");
    expect(response.headers.get("content-security-policy")).toContain("connect-src 'self'");
    await expect(response.text()).resolves.toBe("");
  });
});
