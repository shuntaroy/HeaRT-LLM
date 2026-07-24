import type {
  ClinicalEntity,
  ClinicalRelation,
  ModelUsage,
  RelationType,
  TimelineWarning,
} from "../../shared/timeline";
import { isEntityLabel, isRelationType, REQUIRED_ATTRIBUTES } from "./schema";
import { phaseMessages, type ChatMessage, type PrismPhase } from "./prompts";
import {
  codepointSlice,
  documentToTanl,
  parseRelations,
  parseTanlEntities,
  type PrismEntity,
  type PrismRelation,
} from "./tanl";

export class AnnotationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AnnotationError";
  }
}

export interface AnnotationResult {
  entities: ClinicalEntity[];
  relations: ClinicalRelation[];
  warnings: TimelineWarning[];
  phaseCalls: number;
  usage: ModelUsage | null;
}

export interface ModelCompletion {
  content: string;
  usage: ModelUsage | null;
}

export type CompleteModel = (request: {
  model: string;
  messages: ChatMessage[];
}) => Promise<ModelCompletion>;

export interface OpenRouterSettings {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxOutputTokens: number;
}

interface UsageAccumulator {
  prompt: number;
  completion: number;
  total: number;
  cost: number;
  hasUsage: boolean;
  hasCost: boolean;
}

function createUsageAccumulator(): UsageAccumulator {
  return { prompt: 0, completion: 0, total: 0, cost: 0, hasUsage: false, hasCost: false };
}

function addUsage(accumulator: UsageAccumulator, usage: ModelUsage | null): void {
  if (usage === null) return;
  accumulator.hasUsage = true;
  accumulator.prompt += usage.prompt_tokens ?? 0;
  accumulator.completion += usage.completion_tokens ?? 0;
  accumulator.total += usage.total_tokens ?? 0;
  if (usage.estimated_cost_usd !== null) {
    accumulator.hasCost = true;
    accumulator.cost += usage.estimated_cost_usd;
  }
}

function accumulatedUsage(accumulator: UsageAccumulator): ModelUsage | null {
  if (!accumulator.hasUsage) return null;
  return {
    prompt_tokens: accumulator.prompt,
    completion_tokens: accumulator.completion,
    total_tokens: accumulator.total,
    estimated_cost_usd: accumulator.hasCost ? Number(accumulator.cost.toFixed(8)) : null,
  };
}

function warningCode(raw: string): string {
  const lowered = raw.toLowerCase();
  if (lowered.includes("text mismatch")) return "source-text-mismatch";
  if (lowered.includes("whitespace")) return "source-whitespace-mismatch";
  if (lowered.includes("unknown entity type")) return "unknown-entity-type";
  if (lowered.includes("unparseable")) return "unparseable-relation";
  if (lowered.includes("unknown from_eid") || lowered.includes("unknown to_eid")) return "unknown-relation-endpoint";
  if (lowered.includes("not timex3")) return "invalid-temporal-target";
  if (lowered.includes("wrong phase")) return "wrong-phase-relation";
  return "annotation-warning";
}

function safeWarning(raw: string): TimelineWarning {
  const code = warningCode(raw);
  const messages: Record<string, string> = {
    "source-whitespace-mismatch": "The model changed whitespace while annotating the source.",
    "unknown-entity-type": "The model returned an unsupported entity type.",
    "unparseable-relation": "A model-generated relation could not be parsed.",
    "unknown-relation-endpoint": "A model-generated relation referenced an unknown entity.",
    "invalid-temporal-target": "A model-generated temporal relation had an invalid target.",
    "wrong-phase-relation": "A relation was returned in the wrong extraction phase.",
    "annotation-warning": "The PRISM parser reported an annotation warning.",
  };
  return {
    code,
    severity: "warning",
    message: messages[code] ?? "The PRISM parser reported an annotation warning.",
    entity_ids: [],
    relation_ids: [],
  };
}

export function parseExactEntityOutput(output: string, source: string): [PrismEntity[], string[]] {
  const candidates = [output];
  const trimmed = output.trim();
  if (source === source.trim() && trimmed !== output) candidates.push(trimmed);
  if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
    const firstNewline = trimmed.indexOf("\n");
    const lastNewline = trimmed.lastIndexOf("\n");
    if (firstNewline >= 0 && firstNewline < lastNewline) {
      candidates.push(trimmed.slice(firstNewline + 1, lastNewline));
    }
  }
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const [entities, warnings] = parseTanlEntities(candidate, source);
    const mismatchCodes = new Set(warnings.map(warningCode));
    if (!mismatchCodes.has("source-text-mismatch") && !mismatchCodes.has("source-whitespace-mismatch")) {
      return [entities, warnings];
    }
  }
  throw new AnnotationError("source-text-mismatch", "The model changed the source text, so entity spans are unsafe.");
}

function correctEntity(entity: PrismEntity): boolean {
  const state = entity.attributes.state;
  if (state && ["positive", "suspicious", "negative", "general"].includes(state)) {
    entity.attributes.state = "other";
    return true;
  }
  return false;
}

function mayContainEmbeddedMedicationValue(entity: PrismEntity): boolean {
  return entity.label === "m-key" && /\d[\d.,]*\s*(?:μg|µg|mcg|mg|mL|ml|単位|錠|包)(?![A-Za-z])/iu.test(entity.text);
}

async function completeWithRetry(
  complete: CompleteModel,
  model: string,
  messages: ChatMessage[],
  maxRetries: number,
  usage: UsageAccumulator,
): Promise<{ content: string; calls: number }> {
  for (let calls = 1; calls <= maxRetries + 1; calls += 1) {
    try {
      const result = await complete({ model, messages });
      addUsage(usage, result.usage);
      if (!result.content) throw new AnnotationError("empty-model-output", "The model returned no output.");
      return { content: result.content, calls };
    } catch (error) {
      const retryable =
        !(error instanceof AnnotationError) ||
        !["provider-authentication-failed", "provider-credit-required"].includes(error.code);
      if (calls <= maxRetries && retryable) continue;
      if (error instanceof AnnotationError) throw error;
      throw new AnnotationError("model-request-failed", "The model request failed without preserving its content.");
    }
  }
  throw new AnnotationError("model-request-failed", "The model request failed without preserving its content.");
}

export async function annotatePrism(input: {
  text: string;
  dct: string | null;
  model: string;
  maxRetries: number;
  complete: CompleteModel;
  onPhaseComplete?: (phase: PrismPhase, completed: number) => Promise<void> | void;
}): Promise<AnnotationResult> {
  const usage = createUsageAccumulator();
  let calls = 0;
  const warnings: TimelineWarning[] = [];

  const entityCompletion = await completeWithRetry(
    input.complete,
    input.model,
    phaseMessages("entity", input.text, input.dct),
    input.maxRetries,
    usage,
  );
  calls += entityCompletion.calls;
  const [prismEntities, entityWarnings] = parseExactEntityOutput(entityCompletion.content, input.text);
  warnings.push(...entityWarnings.map(safeWarning));
  for (const entity of prismEntities) {
    if (entity.span === null) throw new AnnotationError("missing-source-span", "An extracted entity has no source span.");
    if (codepointSlice(input.text, entity.span.start, entity.span.end) !== entity.text) {
      throw new AnnotationError("source-span-mismatch", "An extracted entity does not match its source span.");
    }
    if (correctEntity(entity)) {
      warnings.push({
        code: "corrected-entity-attribute",
        severity: "warning",
        message: "An invalid entity attribute was replaced with the PRISM fallback value.",
        entity_ids: [],
        relation_ids: [],
      });
    }
  }
  await input.onPhaseComplete?.("entity", 1);

  const medicalTanl = documentToTanl(input.text, prismEntities);
  const medicalCompletion = await completeWithRetry(
    input.complete,
    input.model,
    phaseMessages("medical_relation", medicalTanl, input.dct),
    input.maxRetries,
    usage,
  );
  calls += medicalCompletion.calls;
  const entityIds = new Set(prismEntities.map((_, index) => `e${index + 1}`));
  const entityLabels = new Map(prismEntities.map((entity, index) => [`e${index + 1}`, entity.label]));
  const [medicalRelations, medicalWarnings] = parseRelations(
    medicalCompletion.content,
    entityIds,
    "medical_relation",
    entityLabels,
  );
  warnings.push(...medicalWarnings.map(safeWarning));
  await input.onPhaseComplete?.("medical_relation", 2);

  const timeEntities = [...prismEntities];
  if (input.dct !== null) {
    timeEntities.push({
      text: `文書作成日(DCT): ${input.dct}`,
      label: "TIMEX3",
      span: null,
      attributes: { type: "DATE" },
    });
  }
  const timeTanl = documentToTanl(input.text, timeEntities);
  const timeCompletion = await completeWithRetry(
    input.complete,
    input.model,
    phaseMessages("time_relation", timeTanl, input.dct),
    input.maxRetries,
    usage,
  );
  calls += timeCompletion.calls;
  const timeIds = new Set(timeEntities.map((_, index) => `e${index + 1}`));
  const timeLabels = new Map(timeEntities.map((entity, index) => [`e${index + 1}`, entity.label]));
  const [timeRelations, timeWarnings] = parseRelations(
    timeCompletion.content,
    timeIds,
    "time_relation",
    timeLabels,
  );
  warnings.push(...timeWarnings.map(safeWarning));
  await input.onPhaseComplete?.("time_relation", 3);

  const stableIds = new Map(timeEntities.map((_, index) => [`e${index + 1}`, `ent-${String(index + 1).padStart(3, "0")}`]));
  const entities: ClinicalEntity[] = timeEntities.map((entity, index) => {
    if (!isEntityLabel(entity.label)) throw new AnnotationError("unknown-entity-type", "The model returned an unsupported entity type.");
    const entityId = stableIds.get(`e${index + 1}`)!;
    if (mayContainEmbeddedMedicationValue(entity)) {
      warnings.push({
        code: "possible-embedded-medication-value",
        severity: "warning",
        message: "A medicine entity appears to contain a dose that was not extracted as a separate value.",
        entity_ids: [entityId],
        relation_ids: [],
      });
    }
    for (const requiredAttribute of REQUIRED_ATTRIBUTES[entity.label] ?? []) {
      if (!(requiredAttribute in entity.attributes)) {
        warnings.push({
          code: "missing-required-attribute",
          severity: "warning",
          message: "An extracted entity is missing a required PRISM attribute.",
          entity_ids: [entityId],
          relation_ids: [],
        });
      }
    }
    return {
      id: entityId,
      label: entity.label,
      text: entity.text,
      span: entity.span,
      attributes: entity.attributes,
      is_dct: input.dct !== null && index === timeEntities.length - 1,
    };
  });

  const relations: ClinicalRelation[] = [...medicalRelations, ...timeRelations].map(
    (relation: PrismRelation, index) => {
      if (!isRelationType(relation.type)) throw new AnnotationError("unparseable-relation", "A model-generated relation could not be parsed.");
      return {
        id: `rel-${String(index + 1).padStart(3, "0")}`,
        type: relation.type,
        source_id: stableIds.get(relation.fromEid)!,
        target_id: stableIds.get(relation.toEid)!,
      };
    },
  );
  return { entities, relations, warnings, phaseCalls: calls, usage: accumulatedUsage(usage) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalTokenCount(value: unknown): number | null {
  const parsed = optionalNumber(value);
  return parsed !== null && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function optionalCost(value: unknown): number | null {
  const parsed = optionalNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

async function readBoundedProviderJson(response: Response, maximumBytes: number): Promise<unknown> {
  if (response.body === null) {
    throw new AnnotationError("invalid-model-response", "The model provider returned an invalid response.");
  }
  const declaredLength = response.headers.get("Content-Length");
  if (declaredLength !== null && Number(declaredLength) > maximumBytes) {
    await response.body.cancel();
    throw new AnnotationError("model-response-too-large", "The model provider response exceeded the permitted size.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let raw = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new AnnotationError("model-response-too-large", "The model provider response exceeded the permitted size.");
    }
    raw += decoder.decode(value, { stream: true });
  }
  raw += decoder.decode();
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AnnotationError("invalid-model-response", "The model provider returned an invalid response.");
  }
}

function parseOpenRouterResponse(value: unknown): ModelCompletion {
  if (!isRecord(value) || !Array.isArray(value.choices) || !isRecord(value.choices[0])) {
    throw new AnnotationError("invalid-model-response", "The model provider returned an invalid response.");
  }
  const message = value.choices[0].message;
  if (!isRecord(message) || typeof message.content !== "string") {
    throw new AnnotationError("invalid-model-response", "The model provider returned an invalid response.");
  }
  let usage: ModelUsage | null = null;
  if (isRecord(value.usage)) {
    usage = {
      prompt_tokens: optionalTokenCount(value.usage.prompt_tokens),
      completion_tokens: optionalTokenCount(value.usage.completion_tokens),
      total_tokens: optionalTokenCount(value.usage.total_tokens),
      estimated_cost_usd: optionalCost(value.usage.cost),
    };
  }
  return { content: message.content, usage };
}

export function createOpenRouterCompletion(settings: OpenRouterSettings): CompleteModel {
  const endpoint = new URL("chat/completions", settings.baseUrl.endsWith("/") ? settings.baseUrl : `${settings.baseUrl}/`);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
    throw new AnnotationError("invalid-provider-url", "The model provider URL must be an HTTPS URL without embedded credentials.");
  }
  return async ({ model, messages }) => {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(settings.timeoutMs),
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/shuntaroy/HeaRT-LLM",
          "X-Title": "HeaRT-LLM",
        },
        body: JSON.stringify({ model, messages, temperature: 0, max_tokens: settings.maxOutputTokens }),
      });
    } catch {
      throw new AnnotationError("model-request-failed", "The model request failed without preserving its content.");
    }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) {
        throw new AnnotationError("provider-authentication-failed", "OpenRouter rejected the API key.");
      }
      if (response.status === 402) {
        throw new AnnotationError("provider-credit-required", "OpenRouter reports that this account has insufficient credit.");
      }
      if (response.status === 429) {
        throw new AnnotationError("provider-rate-limited", "OpenRouter rate-limited the request. Try again later.");
      }
      throw new AnnotationError("model-request-failed", "The model request failed without preserving its content.");
    }
    try {
      const maximumResponseBytes = Math.min(8_000_000, Math.max(65_536, settings.maxOutputTokens * 64 + 65_536));
      return parseOpenRouterResponse(await readBoundedProviderJson(response, maximumResponseBytes));
    } catch (error) {
      if (error instanceof AnnotationError) throw error;
      throw new AnnotationError("invalid-model-response", "The model provider returned an invalid response.");
    }
  };
}
