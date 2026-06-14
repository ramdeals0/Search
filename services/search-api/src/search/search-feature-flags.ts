import type { LlmConfig } from "../llm/types.js";
import { getLlmConfig } from "../llm/llm-config-store.js";

export function getSearchFeatureFlags(): LlmConfig {
  return getLlmConfig();
}

export function isHybridVectorEnabled(): boolean {
  return (
    process.env.HYBRID_SEARCH_ENABLED === "true" ||
    process.env.HYBRID_VECTOR_ENABLED === "true" ||
    process.env.SEMANTIC_SEARCH_ENABLED === "true"
  );
}

export function isAnyLlmFeatureEnabled(config: LlmConfig = getSearchFeatureFlags()): boolean {
  return (
    config.queryRewriteEnabled ||
    config.zeroResultsEnabled ||
    config.rerankEnabled
  );
}
