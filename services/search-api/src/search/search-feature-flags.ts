import type { LlmConfig, LlmProviderName } from "../llm/types.js";
import { resolveDefaultModel } from "../llm/provider.js";

function readBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }
  return value === "true" || value === "1";
}

function readNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readProvider(value: string | undefined): LlmProviderName {
  switch ((value ?? "none").trim().toLowerCase()) {
    case "openrouter":
      return "openrouter";
    case "groq":
      return "groq";
    default:
      return "none";
  }
}

export function getSearchFeatureFlags(): LlmConfig {
  const provider = readProvider(process.env.LLM_PROVIDER);
  const model = process.env.LLM_MODEL?.trim() || resolveDefaultModel(provider);

  return {
    provider,
    model,
    timeoutMs: readNumber(process.env.LLM_TIMEOUT_MS, 4_000),
    cacheTtlMs: readNumber(process.env.LLM_CACHE_TTL_MS, 300_000),
    maxQueryChars: readNumber(process.env.LLM_MAX_QUERY_CHARS, 160),
    rerankTopK: readNumber(process.env.LLM_RERANK_TOP_K, 12),
    debugLogging: readBoolean(process.env.LLM_DEBUG_LOGGING, false),
    queryRewriteEnabled: readBoolean(process.env.LLM_QUERY_REWRITE_ENABLED, false),
    zeroResultsEnabled: readBoolean(process.env.LLM_ZERO_RESULTS_ENABLED, false),
    rerankEnabled: readBoolean(process.env.LLM_RERANK_ENABLED, false),
  };
}

export function isHybridVectorEnabled(): boolean {
  return process.env.HYBRID_VECTOR_ENABLED === "true";
}

export function isAnyLlmFeatureEnabled(config: LlmConfig = getSearchFeatureFlags()): boolean {
  return (
    config.queryRewriteEnabled ||
    config.zeroResultsEnabled ||
    config.rerankEnabled
  );
}
