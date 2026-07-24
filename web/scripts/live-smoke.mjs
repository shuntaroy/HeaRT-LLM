import { createServer } from "vite";

const SYNTHETIC_CASES = {
  en: {
    dct: "2024-01-20",
    text:
      "On 10 January 2024, the patient attended an outpatient appointment. " +
      "A chest CT showed a small nodule in the right lung. " +
      "Prednisolone 10 mg was started on the same day and stopped on 20 January 2024.",
  },
  ja: {
    dct: "2024-01-20",
    text:
      "2024年1月10日に外来を受診した。胸部CTで右肺に小結節を認めた。" +
      "プレドニゾロン10mgを同日から開始し、2024年1月20日に終了した。",
  },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const apiKey = process.env.HEART_SMOKE_OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("HEART_SMOKE_OPENROUTER_API_KEY is not configured.");
  const model = process.env.HEART_SMOKE_MODEL || "openai/gpt-5-mini";
  const language = process.env.HEART_SMOKE_LANGUAGE || "ja";
  const syntheticCase = SYNTHETIC_CASES[language];
  if (!syntheticCase) {
    throw new Error(`Unknown HEART_SMOKE_LANGUAGE "${language}". Expected "en" or "ja".`);
  }

  const vite = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "error",
    server: { middlewareMode: true },
  });
  try {
    const { handleApiRequest } = await vite.ssrLoadModule("./worker/index.ts");
    const backgroundTasks = [];
    const env = {
      HEART_ENVIRONMENT: "local-smoke",
      HEART_ALLOW_LIVE_LLM: "true",
      HEART_MAX_INPUT_CHARS: "20000",
      HEART_LLM_TIMEOUT_MS: "120000",
      HEART_LLM_MAX_RETRIES: "1",
      HEART_MAX_OUTPUT_TOKENS: "16384",
      OPENROUTER_MODEL: model,
      OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
    };
    const request = new Request("https://local.test/api/timelines/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HeaRT-OpenRouter-Key": apiKey,
      },
      body: JSON.stringify({
        text: syntheticCase.text,
        dct: syntheticCase.dct,
        model,
      }),
    });
    const startedAt = performance.now();
    const response = await handleApiRequest(request, env, {
      waitUntil(task) {
        backgroundTasks.push(task);
      },
    });
    assert(response.status === 200, `Expected HTTP 200, received ${response.status}.`);
    assert(
      response.headers.get("cache-control") === "no-store, max-age=0",
      "The live response is missing its no-store policy.",
    );

    assert(response.body, "The Worker returned no response stream.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const events = [];
    const eventTimings = [];
    let buffered = "";
    for (;;) {
      const { done, value } = await reader.read();
      buffered += decoder.decode(value, { stream: !done });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        if (!line) continue;
        const event = JSON.parse(line);
        events.push(event);
        eventTimings.push({ type: event.type, phase: event.phase ?? null, elapsed_ms: Math.round(performance.now() - startedAt) });
      }
      if (done) break;
    }
    if (buffered) {
      const event = JSON.parse(buffered);
      events.push(event);
      eventTimings.push({ type: event.type, phase: event.phase ?? null, elapsed_ms: Math.round(performance.now() - startedAt) });
    }
    await Promise.all(backgroundTasks);
    const failure = events.find((event) => event.type === "error");
    if (failure) throw new Error(`Worker returned ${failure.code}: ${failure.message}`);
    const progress = events.filter((event) => event.type === "progress");
    const resultEvent = events.find((event) => event.type === "result");
    assert(resultEvent, "The stream ended without a timeline result.");
    assert(
      JSON.stringify(progress.map(({ phase, completed, total }) => ({ phase, completed, total }))) ===
        JSON.stringify([
          { phase: "entity", completed: 1, total: 3 },
          { phase: "medical_relation", completed: 2, total: 3 },
          { phase: "time_relation", completed: 3, total: 3 },
        ]),
      "The three PRISM phase events were incomplete or out of order.",
    );

    const timeline = resultEvent.timeline;
    assert(timeline.schema_version === "1.0", "Unexpected timeline schema version.");
    assert(
      timeline.source.text === syntheticCase.text,
      "The result did not preserve the synthetic source.",
    );
    assert(timeline.source.dct === syntheticCase.dct, "The result did not preserve the DCT.");
    assert(timeline.run.persistence === "none", "The result claims an unsupported persistence mode.");
    assert(timeline.entities.some((entity) => entity.is_dct), "The DCT entity is missing.");
    const entityIds = new Set(timeline.entities.map((entity) => entity.id));
    assert(
      timeline.relations.every(
        (relation) => entityIds.has(relation.source_id) && entityIds.has(relation.target_id),
      ),
      "A relation references a missing entity.",
    );

    const warningCodes = [...new Set(timeline.warnings.map((warning) => warning.code))].sort();
    const semanticFailures = [];
    if (timeline.items.length > 0 && timeline.items.every((item) => item.placement.status === "unplaced")) {
      semanticFailures.push("all-items-unplaced");
    }
    if (warningCodes.includes("unparseable-relation")) {
      semanticFailures.push("unparseable-relation");
    }
    const summary = {
      status: semanticFailures.length === 0 ? "passed" : "semantic-review-required",
      model,
      language,
      semantic_failures: semanticFailures,
      schema_version: timeline.schema_version,
      progress_phases: progress.map((event) => event.phase),
      event_timings_ms: eventTimings,
      elapsed_ms: Math.round(performance.now() - startedAt),
      entity_count: timeline.entities.length,
      relation_count: timeline.relations.length,
      relation_types: timeline.relations.map((relation) => relation.type).sort(),
      anchor_count: timeline.anchors.length,
      item_count: timeline.items.length,
      placement_statuses: [...new Set(timeline.items.map((item) => item.placement.status))].sort(),
      warning_codes: warningCodes,
      phase_calls: timeline.run.phase_calls,
      usage: timeline.run.usage,
    };
    console.log(JSON.stringify(summary, null, 2));
    if (semanticFailures.length > 0) process.exitCode = 1;
  } finally {
    await vite.close();
  }
}

await main();
