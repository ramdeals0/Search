import type { AiRankingConfigDto } from "@retailer-search/shared-types";
import { getRerankRuntimeConfig } from "./vector-config.js";

export type LiveRankingMode =
  | "lexical"
  | "hybrid"
  | "hybrid_personalization"
  | "hybrid_rerank";

/** Mirrors storefront default rankingMode when no preview override is applied. */
export function resolveLiveRankingMode(config: AiRankingConfigDto): LiveRankingMode {
  const rerankConfig = getRerankRuntimeConfig();
  if (rerankConfig.enabled) {
    return "hybrid_rerank";
  }
  if (config.personalizationEnabled) {
    return "hybrid_personalization";
  }
  if (config.enabled && config.semanticRetrievalEnabled) {
    return "hybrid";
  }
  return "lexical";
}
