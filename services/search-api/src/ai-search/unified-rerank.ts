import type {
  AiRankingConfigDto,
  AiRankingWeightsDto,
  ProductDocument,
  SearchExplanationCode,
} from "@retailer-search/shared-types";
import {
  computeCommercialPriorityBoost,
  computeInventoryScore,
  computeProfitMarginScore,
  resolveProfitMarginPercent,
} from "@retailer-search/search-core";
import type { FusedCandidate, RetrievalSource } from "./candidate-fusion.js";
import { getRerankRuntimeConfig, type RerankRuntimeConfig } from "./vector-config.js";

export interface PersonalizationEntry {
  score: number;
  codes: SearchExplanationCode[];
}

export interface RerankedCandidate {
  productId: string;
  lexicalScore: number;
  semanticScore: number;
  personalizationScore: number;
  fusedScore: number;
  rerankScore: number;
  finalScore: number;
  retrievalSources: RetrievalSource[];
  explanationCodes: SearchExplanationCode[];
  rulesApplied: string[];
  lexicalHit?: FusedCandidate["lexicalHit"];
}

function mergeWeightedScore(input: {
  lexical: number;
  semantic: number;
  personalization: number;
  weights: AiRankingWeightsDto;
}): number {
  return (
    input.weights.lexicalWeight * input.lexical +
    input.weights.semanticWeight * input.semantic +
    input.weights.personalizationWeight * input.personalization
  );
}

function normalizeScore(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, value / max));
}

/**
 * Optional LLM/cross-encoder rerank hook. Fail-open to score fusion on timeout/error.
 */
async function optionalProviderRerank(
  query: string,
  candidates: RerankedCandidate[],
  productsById: Map<string, ProductDocument>,
  config: RerankRuntimeConfig,
): Promise<Map<string, number>> {
  const adjustments = new Map<string, number>();
  if (!config.enabled || config.provider === "score_fusion" || config.provider === "off") {
    return adjustments;
  }

  const topSlice = candidates.slice(0, config.topN);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    // Integration point for cross-encoder / LLM rerank providers.
    void query;
    void productsById;
    void controller.signal;
    for (const candidate of topSlice) {
      adjustments.set(candidate.productId, 0);
    }
  } catch {
    // Fail open: no provider adjustment.
  } finally {
    clearTimeout(timer);
  }

  return adjustments;
}

export async function unifiedRerankCandidates(input: {
  query: string;
  fused: FusedCandidate[];
  products: ProductDocument[];
  config: AiRankingConfigDto;
  personalizationScores: Map<string, PersonalizationEntry>;
  rerankConfig?: RerankRuntimeConfig;
}): Promise<RerankedCandidate[]> {
  const rerankConfig = input.rerankConfig ?? getRerankRuntimeConfig();
  const productsById = new Map(input.products.map((product) => [product.id, product]));
  const personalizationMax =
    [...input.personalizationScores.values()].reduce(
      (max, entry) => Math.max(max, entry.score),
      0,
    ) || 1;

  const baseRanked: RerankedCandidate[] = input.fused
    .filter((candidate) => productsById.has(candidate.productId))
    .map((candidate) => {
      const product = productsById.get(candidate.productId)!;
      const personalizationEntry = input.personalizationScores.get(candidate.productId);
      const personalizationScore = normalizeScore(
        personalizationEntry?.score ?? 0,
        personalizationMax,
      );
      const fusedScore = mergeWeightedScore({
        lexical: candidate.lexicalScore,
        semantic: candidate.semanticScore,
        personalization: personalizationScore,
        weights: input.config.weights,
      });
      const inventoryScore = computeInventoryScore(product);
      const profitMarginScore = computeProfitMarginScore(product);
      const commercialBoost = (inventoryScore + profitMarginScore) / 100;

      const explanationCodes: SearchExplanationCode[] = [];
      if (candidate.lexicalScore > 0) {
        explanationCodes.push("lexical_match");
      }
      if (candidate.semanticScore > 0) {
        explanationCodes.push("semantic_match");
      }
      for (const code of personalizationEntry?.codes ?? []) {
        explanationCodes.push(code);
      }
      const rulesApplied = candidate.lexicalHit?.rankingDebug?.appliedRuleNames ?? [];
      if (rulesApplied.length > 0) {
        explanationCodes.push("merchandising_rule_applied");
      }
      if (personalizationScore > 0) {
        explanationCodes.push("personalization_rerank");
      }
      if (inventoryScore > 0) {
        explanationCodes.push("in_stock_boost");
      }
      if (profitMarginScore > 0) {
        explanationCodes.push("profit_margin_boost");
      }

      return {
        productId: candidate.productId,
        lexicalScore: candidate.lexicalScore,
        semanticScore: candidate.semanticScore,
        personalizationScore,
        fusedScore,
        rerankScore: fusedScore + commercialBoost,
        finalScore: fusedScore + commercialBoost,
        retrievalSources: candidate.retrievalSources,
        explanationCodes,
        rulesApplied,
        lexicalHit: candidate.lexicalHit,
      };
    });

  baseRanked.sort((a, b) => b.fusedScore - a.fusedScore || a.productId.localeCompare(b.productId));

  if (rerankConfig.enabled) {
    const providerAdjustments = await optionalProviderRerank(
      input.query,
      baseRanked,
      productsById,
      rerankConfig,
    );
    for (const candidate of baseRanked) {
      const adjustment = providerAdjustments.get(candidate.productId) ?? 0;
      const product = productsById.get(candidate.productId);
      const commercialBoost = product ? computeCommercialPriorityBoost(product) / 100 : 0;
      candidate.rerankScore = candidate.fusedScore + commercialBoost + adjustment;
      candidate.finalScore = candidate.rerankScore;
    }
    baseRanked.sort(
      (a, b) => b.finalScore - a.finalScore || a.productId.localeCompare(b.productId),
    );
  }

  return baseRanked;
}

export function rerankedToSearchHits(
  ranked: RerankedCandidate[],
  productsById: Map<string, ProductDocument>,
  debug: boolean,
): import("@retailer-search/shared-types").SearchResponseDto["hits"] {
  return ranked
    .map((entry) => {
      const product = productsById.get(entry.productId);
      if (!product) {
        return null;
      }
      const scaledScore = entry.finalScore * 100;
      const inventoryScore = computeInventoryScore(product);
      const profitMarginScore = computeProfitMarginScore(product);
      const baseHit = entry.lexicalHit ?? {
        id: product.id,
        sku: product.sku,
        title: product.title,
        brand: product.brand,
        category: product.category,
        subcategory: product.subcategory,
        description: product.description,
        price: product.price,
        imageUrl: product.imageUrl,
        inStock: product.inStock,
        score: scaledScore,
      };

      return {
        ...baseHit,
        score: scaledScore,
        rankingDebug: debug
          ? {
              productId: product.id,
              baseScore: entry.lexicalHit?.rankingDebug?.baseScore ?? 0,
              exactMatchScore: entry.lexicalHit?.rankingDebug?.exactMatchScore ?? 0,
              inventoryScore: entry.lexicalHit?.rankingDebug?.inventoryScore ?? inventoryScore,
              popularityScore: entry.lexicalHit?.rankingDebug?.popularityScore ?? 0,
              profitMarginScore:
                entry.lexicalHit?.rankingDebug?.profitMarginScore ?? profitMarginScore,
              profitMarginPercent:
                entry.lexicalHit?.rankingDebug?.profitMarginPercent ??
                resolveProfitMarginPercent(product),
              merchandisingAdjustment:
                entry.lexicalHit?.rankingDebug?.merchandisingAdjustment ?? 0,
              finalScore: scaledScore,
              appliedRuleNames: entry.rulesApplied,
              lexicalScore: entry.lexicalScore,
              semanticScore: entry.semanticScore,
              personalizationScore: entry.personalizationScore,
              fusedScore: entry.fusedScore,
              rerankScore: entry.rerankScore,
              retrievalSources: entry.retrievalSources,
              explanationCodes: entry.explanationCodes,
            }
          : undefined,
      };
    })
    .filter(Boolean) as import("@retailer-search/shared-types").SearchResponseDto["hits"];
}
