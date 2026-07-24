import { AnnotationError } from "./annotation/prism";

export interface RuntimeSettings {
  environment: string;
  allowLiveLlm: boolean;
  maxInputChars: number;
  timeoutMs: number;
  maxRetries: number;
  maxOutputTokens: number;
  defaultModel: string;
  openRouterBaseUrl: string;
}

function integerSetting(value: string, name: string, minimum: number, maximum: number): number {
  if (!/^\d+$/u.test(value)) throw new AnnotationError("invalid-configuration", `${name} must be an integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new AnnotationError("invalid-configuration", `${name} is outside its permitted range.`);
  }
  return parsed;
}

export function loadSettings(env: Env): RuntimeSettings {
  const defaultModel = env.OPENROUTER_MODEL.trim();
  if (!defaultModel || defaultModel.length > 200) {
    throw new AnnotationError(
      "invalid-configuration",
      "The configured default model must be a non-empty identifier of at most 200 characters.",
    );
  }
  const baseUrl = new URL(env.OPENROUTER_BASE_URL);
  if (baseUrl.protocol !== "https:" || baseUrl.username || baseUrl.password) {
    throw new AnnotationError("invalid-configuration", "The provider base URL must use HTTPS without embedded credentials.");
  }
  return {
    environment: env.HEART_ENVIRONMENT,
    allowLiveLlm: env.HEART_ALLOW_LIVE_LLM.toLowerCase() === "true",
    maxInputChars: integerSetting(env.HEART_MAX_INPUT_CHARS, "HEART_MAX_INPUT_CHARS", 1, 100_000),
    timeoutMs: integerSetting(env.HEART_LLM_TIMEOUT_MS, "HEART_LLM_TIMEOUT_MS", 1_000, 300_000),
    maxRetries: integerSetting(env.HEART_LLM_MAX_RETRIES, "HEART_LLM_MAX_RETRIES", 0, 3),
    maxOutputTokens: integerSetting(env.HEART_MAX_OUTPUT_TOKENS, "HEART_MAX_OUTPUT_TOKENS", 1, 65_536),
    defaultModel,
    openRouterBaseUrl: baseUrl.toString(),
  };
}
