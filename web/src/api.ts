import type { TimelineDocument } from "./types";

export type AnalysisPhase = "entity" | "medical_relation" | "time_relation";

export interface AnalysisProgress {
  phase: AnalysisPhase;
  completed: number;
  total: 3;
}

type StreamEvent =
  | ({ type: "progress" } & AnalysisProgress)
  | { type: "result"; timeline: TimelineDocument }
  | { type: "error"; code: string; message: string };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function analyseTimeline(input: {
  text: string;
  dct: string;
  model: string;
  apiKey?: string;
}, onProgress?: (progress: AnalysisProgress) => void): Promise<TimelineDocument> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (input.apiKey?.trim()) headers["X-HeaRT-OpenRouter-Key"] = input.apiKey.trim();
  const response = await fetch("/api/timelines/stream", {
    method: "POST",
    cache: "no-store",
    credentials: "omit",
    headers,
    body: JSON.stringify({
      text: input.text,
      dct: input.dct || null,
      model: input.model || null,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: { code?: string; message?: string } }
      | null;
    throw new ApiError(
      payload?.detail?.message ?? "Analysis failed before a timeline was produced.",
      payload?.detail?.code ?? "analysis-failed",
      response.status,
    );
  }

  if (!response.body) {
    throw new ApiError(
      "The analysis service did not provide a progress stream.",
      "missing-progress-stream",
      502,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: TimelineDocument | null = null;

  function acceptLine(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as StreamEvent;
    if (event.type === "progress") onProgress?.(event);
    if (event.type === "result") result = event.timeline;
    if (event.type === "error") {
      throw new ApiError(event.message, event.code, 502);
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(acceptLine);
    if (done) break;
  }
  acceptLine(buffer);

  if (!result) {
    throw new ApiError(
      "Analysis ended before a timeline was produced.",
      "incomplete-progress-stream",
      502,
    );
  }
  return result;
}
