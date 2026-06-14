import { searchProducts, type ProductSearchIndex, type QueryProcessorConfig } from "@retailer-search/search-core";
import type {
  AiRankingConfigDto,
  AiRankingDebugDto,
  AiSearchPreviewMode,
  ExtendedRankingDebugDto,
  MerchandisingRule,
  ProductDocument,
  SearchExplanationCode,
  SearchRequestDto,
  SearchResponseDto,
} from "@retailer-search/shared-types";
import { resolveEmbeddingProviderFromEnv } from "./embedding-provider.js";
import {
  computePersonalizationScores,
  getPersonalizationBoosts,
} from "./personalization-profile-service.js";
import { StoredVectorSearchProvider } from "./vector-index.js";

export interface HybridRankingOptions {
  rules?: MerchandisingRule[];
  debug?: boolean;
  index?: ProductSearchIndex;
  queryProcessorConfig?: QueryProcessorConfig;
  config: AiRankingConfigDto;
  sessionId?: string;
  previewMode?: AiSearchPreviewMode;
  experimentArm?: "baseline" | "candidate" | null;
}

function normalizeScore(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, value / max));
}

function mergeWeightedScore(input: {
  lexical: number;
  semantic: number;
  personalization: number;
  weights: AiRankingConfigDto["weights"];
}): number {
  return (
    input.weights.lexicalWeight * input.lexical +
    input.weights.semanticWeight * input.semantic +
    input.weights.personalizationWeight * input.personalization
  );
}

function extendRankingDebug(
  hit: SearchResponseDto["hits"][number],
  input: {
    lexicalScore: number;
    semanticScore: number;
    personalizationScore: number;
    explanationCodes: SearchExplanationCode[];
    finalScore: number;
  },
): ExtendedRankingDebugDto | undefined {
  if (!hit.rankingDebug) {
    return undefined;
  }
  return {
    ...hit.rankingDebug,
    lexicalScore: input.lexicalScore,
    semanticScore: input.semanticScore,
    personalizationScore: input.personalizationScore,
    explanationCodes: input.explanationCodes,
    finalScore: input.finalScore,
  };
}

export async function executeHybridRankingPipeline(
  products: ProductDocument[],
  request: SearchRequestDto,
  options: HybridRankingOptions,
): Promise<SearchResponseDto & { aiRankingDebug?: AiRankingDebugDto }> {
  const started = Date.now();
  const config = options.config;
  const lexicalResult = searchProducts(products, request, {
    rules: options.rules,
    debug: options.debug,
    index: options.index,
    queryProcessorConfig: options.queryProcessorConfig,
  });

  const lexicalMax = lexicalResult.hits[0]?.score ?? 1;
  let semanticRecoveryApplied = false;
  let semanticHits = 0;

  const semanticScores = new Map<string, number>();
  if (config.enabled && config.semanticRetrievalEnabled) {
    const provider = resolveEmbeddingProviderFromEnv({
      provider: config.embeddingsProvider,
      model: config.embeddingsModel,
      dimensions: config.embeddingDimensions,
    });
    const vectorProvider = new StoredVectorSearchProvider(provider, products);
    const vectorLimit = Math.max(request.pageSize * 5, 50);
    const vectorResults = await vectorProvider.search(request.query, vectorLimit);
    semanticHits = vectorResults.length;
    for (const hit of vectorResults) {
      semanticScores.set(hit.productId, hit.score);
    }
  }

  const semanticMax =
    [...semanticScores.values()].reduce((max, value) => Math.max(max, value), 0) || 1;

  let candidateHits = lexicalResult.hits;
  if (
    config.semanticZeroResultsFallbackEnabled &&
    lexicalResult.totalHits < config.semanticFallbackMinHits &&
    semanticScores.size > 0
  ) {
    semanticRecoveryApplied = true;
    const productById = new Map(products.map((product) => [product.id, product]));
    const rescued = [...semanticScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, request.pageSize)
      .map(([productId, semanticScore]) => {
        const product = productById.get(productId);
        if (!product) {
          return null;
        }
        return {
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
          score: semanticScore * 100,
          rankingDebug: options.debug
            ? {
                productId: product.id,
                baseScore: 0,
                exactMatchScore: 0,
                inventoryScore: 0,
                popularityScore: 0,
                merchandisingAdjustment: 0,
                finalScore: semanticScore * 100,
                appliedRuleNames: [],
                lexicalScore: 0,
                semanticScore,
                explanationCodes: ["zero_results_semantic_recovery", "semantic_match"],
              }
            : undefined,
        };
      })
      .filter(Boolean) as SearchResponseDto["hits"];

    if (rescued.length > 0) {
      candidateHits = rescued;
    }
  }

  const personalizationScores = options.sessionId
    ? await computePersonalizationScores(options.sessionId, products, config)
    : new Map();
  const personalizationMax =
    [...personalizationScores.values()].reduce(
      (max, entry) => Math.max(max, entry.score),
      0,
    ) || 1;

  const mergedHits = candidateHits.map((hit) => {
    const lexicalScore = normalizeScore(hit.score, lexicalMax);
    const semanticScore = normalizeScore(semanticScores.get(hit.id) ?? 0, semanticMax);
    const personalizationEntry = personalizationScores.get(hit.id);
    const personalizationScore = normalizeScore(
      personalizationEntry?.score ?? 0,
      personalizationMax,
    );

    const explanationCodes: SearchExplanationCode[] = [];
    if (lexicalScore > 0) {
      explanationCodes.push("lexical_match");
    }
    if (semanticScore > 0) {
      explanationCodes.push("semantic_match");
    }
    if (semanticRecoveryApplied && semanticScore > 0) {
      explanationCodes.push("zero_results_semantic_recovery");
    }
    for (const code of personalizationEntry?.codes ?? []) {
      explanationCodes.push(code);
    }
    if ((hit.rankingDebug?.appliedRuleNames.length ?? 0) > 0) {
      explanationCodes.push("merchandising_rule_applied");
    }
    if (personalizationScore > 0) {
      explanationCodes.push("personalization_rerank");
    }

    const weightedScore = mergeWeightedScore({
      lexical: lexicalScore,
      semantic: semanticScore,
      personalization: personalizationScore,
      weights: config.weights,
    });

    const scaledScore = weightedScore * 100;
    return {
      ...hit,
      score: scaledScore,
      rankingDebug: extendRankingDebug(hit, {
        lexicalScore,
        semanticScore,
        personalizationScore,
        explanationCodes,
        finalScore: scaledScore,
      }),
    };
  });

  mergedHits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const rankingMode =
    options.previewMode ??
    (config.personalizationEnabled
      ? "hybrid_personalization"
      : config.semanticRetrievalEnabled
        ? "hybrid"
        : "lexical");

  return {
    ...lexicalResult,
    hits: mergedHits,
    processingTimeMs: Date.now() - started,
    rankingMode,
    aiRankingDebug: {
      rankingMode,
      lexicalWeight: config.weights.lexicalWeight,
      semanticWeight: config.weights.semanticWeight,
      personalizationWeight: config.weights.personalizationWeight,
      semanticHits,
      semanticRecoveryApplied,
      embeddingProvider: config.embeddingsProvider,
      embeddingModel: config.embeddingsModel,
      experimentArm: options.experimentArm ?? undefined,
    },
    experimentArm: options.experimentArm ?? undefined,
  };
}

export async function applyPersonalizationRerank(
  result: SearchResponseDto,
  products: ProductDocument[],
  sessionId: string | undefined,
  config: AiRankingConfigDto,
): Promise<SearchResponseDto> {
  if (!sessionId || !config.personalizationEnabled) {
    return result;
  }
  const boosts = await getPersonalizationBoosts(sessionId, products, config);
  if (boosts.size === 0) {
    return result;
  }
  const hits = result.hits
    .map((hit) => ({
      ...hit,
      score: hit.score + (boosts.get(hit.id) ?? 0),
    }))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return { ...result, hits };
}
