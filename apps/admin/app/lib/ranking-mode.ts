const RANKING_MODE_LABELS: Record<string, string> = {
  lexical: "Lexical",
  hybrid: "Hybrid (lexical + semantic)",
  hybrid_personalization: "Hybrid + personalization",
  hybrid_rerank: "Hybrid + rerank",
  semantic: "Semantic only",
  semantic_rescue: "Semantic zero-results rescue",
  live: "Live storefront",
};

const RANKING_MODE_DESCRIPTIONS: Record<string, string> = {
  lexical:
    "Keyword relevance, merchandising rules, and inventory signals without vector retrieval.",
  hybrid:
    "Fuses lexical candidates with embedding similarity when hybrid search and semantic retrieval are enabled.",
  hybrid_personalization:
    "Hybrid fusion plus session-based personalization boosts for signed-in shoppers.",
  hybrid_rerank:
    "Hybrid fusion with an additional reranking stage (score fusion, cross-encoder, or LLM).",
  semantic: "Vector similarity only; lexical ranking is bypassed for preview.",
  semantic_rescue:
    "Semantic fallback when lexical search returns too few results.",
  live: "Same pipeline used by the live storefront search API.",
};

export function formatRankingMode(mode: string | undefined): string {
  if (!mode) {
    return "Unknown";
  }
  return RANKING_MODE_LABELS[mode] ?? mode.replace(/_/g, " ");
}

export function rankingModeDescription(mode: string | undefined): string {
  if (!mode) {
    return "Ranking mode could not be determined.";
  }
  return RANKING_MODE_DESCRIPTIONS[mode] ?? "Custom or experimental ranking mode.";
}
