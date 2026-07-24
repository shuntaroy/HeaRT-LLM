import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { annotatePrism, createOpenRouterCompletion, parseExactEntityOutput, type CompleteModel } from "./prism";

describe("PRISM edge adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs three phases without retaining raw model output", async () => {
    const outputs = [
      "[2024年1月10日 | TIMEX3(DATE)]に[受診 | cc(+)]した。",
      "(なし)",
      "timeOn: e2 -> e1",
    ];
    const complete: CompleteModel = vi.fn(async () => ({
      content: outputs.shift()!,
      usage: {
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
        estimated_cost_usd: 0.0001,
      },
    }));
    const phases: Array<[string, number]> = [];

    const result = await annotatePrism({
      text: "2024年1月10日に受診した。",
      dct: "2024-01-10",
      model: "openai/gpt-5-mini",
      maxRetries: 0,
      complete,
      onPhaseComplete: (phase, completed) => {
        phases.push([phase, completed]);
      },
    });

    expect(complete).toHaveBeenCalledTimes(3);
    expect(result.phaseCalls).toBe(3);
    expect(result.entities.map((entity) => entity.label)).toEqual(["TIMEX3", "cc", "TIMEX3"]);
    expect(result.entities.at(-1)?.is_dct).toBe(true);
    expect(result.relations[0].type).toBe("timeOn");
    expect(result.usage?.total_tokens).toBe(360);
    expect(JSON.stringify(result)).not.toContain("timeOn: e2 -> e1");
    expect(phases).toEqual([
      ["entity", 1],
      ["medical_relation", 2],
      ["time_relation", 3],
    ]);
  });

  it("preserves the frozen PRISM prompt and contract reference", async () => {
    const reference = {
      input: {
        text: "2024年1月10日にプレドニゾロン10mgを開始した。",
        dct: "2024-01-10",
        model: "openai/gpt-5-mini",
        outputs: [
          "[2024年1月10日 | TIMEX3(DATE)]に[プレドニゾロン10mg | m-key(+)]を[開始 | r(+)]した。",
          "(なし)",
          "timeOn: e2 -> e1\ntimeOn: e3 -> e1",
        ],
      },
      requestDigest: "59e5468adbc544c24d0ae134414d722227e19eabe04767df5cf86d60a5040d31",
      result: {
        entities: [
          {
            id: "ent-001",
            label: "TIMEX3",
            text: "2024年1月10日",
            span: { start: 0, end: 10 },
            attributes: { type: "DATE" },
            is_dct: false,
          },
          {
            id: "ent-002",
            label: "m-key",
            text: "プレドニゾロン10mg",
            span: { start: 11, end: 22 },
            attributes: { state: "executed" },
            is_dct: false,
          },
          {
            id: "ent-003",
            label: "r",
            text: "開始",
            span: { start: 23, end: 25 },
            attributes: { state: "executed" },
            is_dct: false,
          },
          {
            id: "ent-004",
            label: "TIMEX3",
            text: "文書作成日(DCT): 2024-01-10",
            span: null,
            attributes: { type: "DATE" },
            is_dct: true,
          },
        ],
        relations: [
          { id: "rel-001", type: "timeOn", source_id: "ent-002", target_id: "ent-001" },
          { id: "rel-002", type: "timeOn", source_id: "ent-003", target_id: "ent-001" },
        ],
        warnings: [
          {
            code: "possible-embedded-medication-value",
            severity: "warning",
            message: "A medicine entity appears to contain a dose that was not extracted as a separate value.",
            entity_ids: ["ent-002"],
            relation_ids: [],
          },
        ],
        phaseCalls: 3,
        usage: {
          prompt_tokens: 300,
          completion_tokens: 60,
          total_tokens: 360,
          estimated_cost_usd: 0.0003,
        },
      },
    };
    const outputs = [...reference.input.outputs];
    const requests: Array<{ model: string; messages: unknown[] }> = [];
    const complete: CompleteModel = async (request) => {
      requests.push(request);
      return {
        content: outputs.shift()!,
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
          total_tokens: 120,
          estimated_cost_usd: 0.0001,
        },
      };
    };

    const result = await annotatePrism({
      text: reference.input.text,
      dct: reference.input.dct,
      model: reference.input.model,
      maxRetries: 0,
      complete,
    });

    expect(createHash("sha256").update(JSON.stringify(requests)).digest("hex")).toBe(
      reference.requestDigest,
    );
    expect(result).toEqual(reference.result);
  });

  it("accepts only a harmless Markdown fence around exact TANL", () => {
    const [entities, warnings] = parseExactEntityOutput(
      "```text\n[受診 | cc(+)]した。\n```",
      "受診した。",
    );

    expect(warnings).toEqual([]);
    expect(entities[0]).toMatchObject({ text: "受診", span: { start: 0, end: 2 } });
  });

  it("retries safely without surfacing provider error content", async () => {
    let attempts = 0;
    const complete: CompleteModel = async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("confidential provider payload");
      return { content: attempts === 2 ? "[咳 | d(+)]あり。" : "(なし)", usage: null };
    };

    const result = await annotatePrism({
      text: "咳あり。",
      dct: null,
      model: "openai/gpt-5-mini",
      maxRetries: 1,
      complete,
    });

    expect(attempts).toBe(4);
    expect(result.phaseCalls).toBe(4);
    expect(result.entities[0].text).toBe("咳");
  });

  it("rejects an oversized provider response before parsing it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: "x".repeat(70_000) } }] }),
          { headers: { "Content-Type": "application/json" } },
        )),
    );
    const complete = createOpenRouterCompletion({
      apiKey: "synthetic-secret",
      baseUrl: "https://example.test/v1",
      timeoutMs: 1_000,
      maxOutputTokens: 1,
    });

    await expect(complete({ model: "synthetic-model", messages: [] })).rejects.toMatchObject({
      code: "model-response-too-large",
    });
  });
});
