import type { RunMetadata, TimelineDocument } from "../shared/timeline";
import {
  annotatePrism,
  AnnotationError,
  createOpenRouterCompletion,
  type CompleteModel,
} from "./annotation/prism";
import { loadSettings, type RuntimeSettings } from "./settings";
import { buildTimeline, sha256Hex } from "./timeline/engine";

const JSON_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;
const STREAM_HEADERS = {
  ...JSON_HEADERS,
  "Content-Type": "application/x-ndjson; charset=utf-8",
} as const;
const USER_API_KEY_HEADER = "X-HeaRT-OpenRouter-Key";
const ASSET_SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'none'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

interface AnalyseRequest {
  text: string;
  dct: string | null;
  model: string;
}

interface ParsedAnalyseRequest {
  input: AnalyseRequest;
  apiKey: string;
}

type WaitUntilContext = Pick<ExecutionContext, "waitUntil">;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, { status, headers: JSON_HEADERS });
}

function errorResponse(error: HttpError | AnnotationError): Response {
  const status = error instanceof HttpError ? error.status : 502;
  return json({ detail: { code: error.code, message: error.message } }, status);
}

async function readBoundedBody(request: Request, maximumBytes: number): Promise<string> {
  if (request.body === null) throw new HttpError(400, "missing-body", "A JSON request body is required.");
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength !== null && Number(declaredLength) > maximumBytes) {
    throw new HttpError(413, "request-too-large", "The request body exceeds the permitted size.");
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return result + decoder.decode();
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new HttpError(413, "request-too-large", "The request body exceeds the permitted size.");
    }
    result += decoder.decode(value, { stream: true });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  if (Number(match[1]) < 1) return false;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
  );
}

function resolveUserApiKey(request: Request): string {
  const suppliedKey = request.headers.get(USER_API_KEY_HEADER);
  if (suppliedKey === null) {
    throw new HttpError(401, "missing-api-key", "Add your OpenRouter API key in settings before analysing.");
  }
  const key = suppliedKey.trim();
  if (!key || key.length > 512) {
    throw new HttpError(400, "invalid-api-key", "Enter a valid OpenRouter API key in settings.");
  }
  return key;
}

async function parseAnalyseRequest(request: Request, settings: RuntimeSettings): Promise<ParsedAnalyseRequest> {
  if (request.method !== "POST") throw new HttpError(405, "method-not-allowed", "Use POST for timeline analysis.");
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new HttpError(415, "unsupported-media-type", "Use an application/json request body.");
  if (!settings.allowLiveLlm) throw new HttpError(503, "live-llm-disabled", "Live model analysis is disabled on this Worker.");
  const apiKey = resolveUserApiKey(request);

  // A JSON-escaped non-BMP code point can occupy twelve ASCII bytes.
  const maximumBytes = settings.maxInputChars * 12 + 4_096;
  let value: unknown;
  try {
    value = JSON.parse(await readBoundedBody(request, maximumBytes));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "invalid-json", "The request body is not valid JSON.");
  }
  if (!isRecord(value)) throw new HttpError(422, "invalid-request", "The request body must be a JSON object.");
  const allowedKeys = new Set(["text", "dct", "model"]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw new HttpError(422, "unexpected-field", "The request contains an unsupported field.");
  }
  if (typeof value.text !== "string" || !value.text.trim()) {
    throw new HttpError(422, "empty-text", "Enter clinical text to analyse.");
  }
  if (Array.from(value.text).length > settings.maxInputChars) {
    throw new HttpError(413, "input-too-large", `Input exceeds the ${settings.maxInputChars}-character limit.`);
  }
  if (value.dct !== undefined && value.dct !== null && (typeof value.dct !== "string" || !isIsoDate(value.dct))) {
    throw new HttpError(422, "invalid-dct", "Document creation date must use YYYY-MM-DD.");
  }
  if (
    value.model !== undefined &&
    value.model !== null &&
    typeof value.model !== "string"
  ) {
    throw new HttpError(422, "invalid-model", "Model must be a non-empty identifier of at most 200 characters.");
  }
  const model =
    typeof value.model === "string" ? value.model.trim() : settings.defaultModel;
  if (!model || model.length > 200) {
    throw new HttpError(422, "invalid-model", "Model must be a non-empty identifier of at most 200 characters.");
  }
  return {
    input: { text: value.text, dct: typeof value.dct === "string" ? value.dct : null, model },
    apiKey,
  };
}

async function analyse(
  input: AnalyseRequest,
  settings: RuntimeSettings,
  complete: CompleteModel,
  onPhaseComplete?: Parameters<typeof annotatePrism>[0]["onPhaseComplete"],
): Promise<TimelineDocument> {
  const annotation = await annotatePrism({
    ...input,
    maxRetries: settings.maxRetries,
    complete,
    onPhaseComplete,
  });
  const digest = await sha256Hex(input.text);
  const run: RunMetadata = {
    annotator: "prism-annotator-ts",
    annotator_version: "0.2.1-port.1",
    model: input.model,
    phase_calls: annotation.phaseCalls,
    generated_at: new Date().toISOString(),
    persistence: "none",
    usage: annotation.usage,
  };
  return buildTimeline({
    documentId: `doc-${digest.slice(0, 12)}`,
    text: input.text,
    dct: input.dct,
    entities: annotation.entities,
    relations: annotation.relations,
    run,
    initialWarnings: annotation.warnings,
    sourceDigest: digest,
  });
}

function completionFor(settings: RuntimeSettings, apiKey: string): CompleteModel {
  return createOpenRouterCompletion({
    apiKey,
    baseUrl: settings.openRouterBaseUrl,
    timeoutMs: settings.timeoutMs,
    maxOutputTokens: settings.maxOutputTokens,
  });
}

async function streamTimeline(
  input: AnalyseRequest,
  apiKey: string,
  settings: RuntimeSettings,
  ctx: WaitUntilContext,
): Promise<Response> {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const write = (event: unknown) => writer.write(encoder.encode(`${JSON.stringify(event)}\n`));
  const producer = (async () => {
    try {
      const timeline = await analyse(input, settings, completionFor(settings, apiKey), async (phase, completed) => {
        await write({ type: "progress", phase, completed, total: 3 });
      });
      await write({ type: "result", timeline });
    } catch (error) {
      if (error instanceof AnnotationError) {
        await write({ type: "error", code: error.code, message: error.message });
      } else {
        console.error(JSON.stringify({ message: "analysis failed", code: "unexpected-analysis-error" }));
        await write({ type: "error", code: "analysis-failed", message: "Analysis failed before a timeline was produced." });
      }
    } finally {
      await writer.close();
    }
  })();
  ctx.waitUntil(producer);
  return new Response(readable, { headers: STREAM_HEADERS });
}

export async function handleApiRequest(request: Request, env: Env, ctx: WaitUntilContext): Promise<Response> {
  const url = new URL(request.url);
  let settings: RuntimeSettings;
  try {
    settings = loadSettings(env);
  } catch (error) {
    if (error instanceof AnnotationError) {
      return json({ detail: { code: error.code, message: error.message } }, 500);
    }
    return json({ detail: { code: "invalid-configuration", message: "Worker configuration is invalid." } }, 500);
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    return json({
      status: "ok",
      version: "1.0.0",
      runtime: "cloudflare-worker",
      live_llm_enabled: settings.allowLiveLlm,
      requires_user_api_key: true,
      analysis_available: settings.allowLiveLlm,
    });
  }
  if (url.pathname !== "/api/timelines" && url.pathname !== "/api/timelines/stream") {
    return json({ detail: { code: "not-found", message: "API route not found." } }, 404);
  }

  try {
    const { input, apiKey } = await parseAnalyseRequest(request, settings);
    if (url.pathname === "/api/timelines/stream") return streamTimeline(input, apiKey, settings, ctx);
    return json(await analyse(input, settings, completionFor(settings, apiKey)));
  } catch (error) {
    if (error instanceof HttpError || error instanceof AnnotationError) return errorResponse(error);
    console.error(JSON.stringify({ message: "request failed", code: "unexpected-request-error", path: url.pathname }));
    return json({ detail: { code: "analysis-failed", message: "Analysis failed before a timeline was produced." } }, 500);
  }
}

export async function handleRequest(request: Request, env: Env, ctx: WaitUntilContext): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return handleApiRequest(request, env, ctx);
  if (request.method === "HEAD") {
    const asset = await env.ASSETS.fetch(new Request(request, { method: "GET" }));
    const headers = new Headers(asset.headers);
    for (const [name, value] of Object.entries(ASSET_SECURITY_HEADERS)) headers.set(name, value);
    return new Response(null, {
      status: asset.status,
      statusText: asset.statusText,
      headers,
    });
  }
  const asset = await env.ASSETS.fetch(request);
  const headers = new Headers(asset.headers);
  for (const [name, value] of Object.entries(ASSET_SECURITY_HEADERS)) headers.set(name, value);
  return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
