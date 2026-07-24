import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("Worker runtime", () => {
  it("serves health from the configured preview environment", async () => {
    const response = await exports.default.fetch("https://example.test/api/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      version: "1.0.0",
      runtime: "cloudflare-worker",
      live_llm_enabled: true,
      requires_user_api_key: true,
      analysis_available: true,
    });
  });

  it("requires a request-scoped key without making a provider call", async () => {
    const response = await exports.default.fetch("https://example.test/api/timelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "synthetic clinical fixture" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      detail: {
        code: "missing-api-key",
        message: "Add your OpenRouter API key in settings before analysing.",
      },
    });
  });
});
