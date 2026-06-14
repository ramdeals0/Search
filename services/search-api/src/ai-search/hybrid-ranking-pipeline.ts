import { searchProducts, type ProductSearchIndex, type QueryProcessorConfig } from "@retailer-search/search-core";
import type {
  AiRankingConfigDto,
  AiRankingDebugDto,
  AiSearchPreviewMode,
  MerchandisingRule,
  ProductDocument,
  SearchExplanationCode,
  SearchRequestDto,
  SearchResponseDto,
} from "@retailer-search/shared-types";
import { fuseRetrievalCandidates } from "./candidate-fusion.js";
import { resolveEmbeddingProviderFromEnv } from "./embedding-provider.js";
import {
  computePersonalizationScores,
  getPersonalizationBoosts,
} from "./personalization-profile-service.js";
import {
  rerankedToSearchHits,
  unifiedRerankCandidates,
  type PersonalizationEntry,
} from "./unified-rerank.js";
import { getRerankRuntimeConfig, getVectorSearchRuntimeConfig } from "./vector-config.js";
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

function buildSemanticOnlyHits(
  products: ProductDocument[],
  semanticHits: Array<{ productId: string; score: number }>,
  pageSize: number,
  debug: boolean,
): SearchResponseDto["hits"] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const semanticMax =
    semanticHits.reduce((max, hit) => Math.max(max, hit.score), 0) || 1;

  return semanticHits
    .slice(0, pageSize)
    .map((hit) => {
      const product = productById.get(hit.productId);
      if (!product) {
        return null;
      }
      const normalized = hit.score / semanticMax;
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
        score: normalized * 100,
        rankingDebug: debug
          ? {
              productId: product.id,
              baseScore: 0,
              exactMatchScore: 0,
              inventoryScore: 0,
              popularityScore: 0,
              merchandisingAdjustment: 0,
              finalScore: normalized * 100,
              appliedRuleNames: [],
              lexicalScore: 0,
              semanticScore: normalized,
              fusedScore: normalized,
              rerankScore: normalized,
              retrievalSources: ["semantic"],
              explanationCodes: ["semantic_match"] as SearchExplanationCode[],
            }
          : undefined,
      };
    })
    .filter(Boolean) as SearchResponseDto["hits"];
}

export async function executeHybridRankingPipeline(
  products: ProductDocument[],
  request: SearchRequestDto,
  options: HybridRankingOptions,
): Promise<SearchResponseDto & { aiRankingDebug?: AiRankingDebugDto }> {
  const started = Date.now();
  const config = options.config;
  const vectorConfig = getVectorSearchRuntimeConfig();
  const rerankConfig = getRerankRuntimeConfig();
  const semanticOnly = options.previewMode === "semantic";
  const rerankPreview = options.previewMode === "hybrid_rerank";

  const lexicalResult = searchProducts(products, request, {
    rules: options.rules,
    debug: options.debug,
    index: options.index,
    queryProcessorConfig: options.queryProcessorConfig,
  });

  let semanticRecoveryApplied = false;
  let semanticHits = 0;
  const semanticRawHits: Array<{ productId: string; score: number }> = [];

  if (config.enabled && config.semanticRetrievalEnabled && vectorConfig.pgvectorEnabled) {
    try {
      const provider = resolveEmbeddingProviderFromEnv({
        provider: config.embeddingsProvider,
        model: config.embeddingsModel,
        dimensions: config.embeddingDimensions,
      });
      const vectorProvider = new StoredVectorSearchProvider(
        provider,
        products,
        products.map((product) => product.id),
      );
      const vectorLimit = Math.max(request.pageSize * 5, 50);
      const vectorResults = await vectorProvider.search(request.query, vectorLimit);
      semanticHits = vectorResults.length;
      for (const hit of vectorResults) {
        semanticRawHits.push(hit);
      }
    } catch (error) {
      console.warn(
        "Vector retrieval failed; continuing with lexical only:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (semanticOnly) {
    const hits = buildSemanticOnlyHits(
      products,
      semanticRawHits,
      request.pageSize,
      Boolean(options.debug),
    );
    return {
      ...lexicalResult,
      hits,
      totalHits: hits.length,
      totalPages: hits.length > 0 ? 1 : 0,
      processingTimeMs: Date.now() - started,
      rankingMode: "semantic",
      aiRankingDebug: {
        rankingMode: "semantic",
        lexicalWeight: config.weights.lexicalWeight,
        semanticWeight: config.weights.semanticWeight,
        personalizationWeight: config.weights.personalizationWeight,
        semanticHits,
        semanticRecoveryApplied: false,
        embeddingProvider: config.embeddingsProvider,
        embeddingModel: config.embeddingsModel,
        vectorIndexType: vectorConfig.indexType,
        rerankEnabled: rerankConfig.enabled,
        rerankProvider: rerankConfig.provider,
        experimentArm: options.experimentArm ?? undefined,
      },
      experimentArm: options.experimentArm ?? undefined,
    };
  }

  if (
    config.semanticZeroResultsFallbackEnabled &&
    lexicalResult.totalHits < config.semanticFallbackMinHits &&
    semanticRawHits.length > 0 &&
    options.previewMode === "semantic_rescue"
  ) {
    semanticRecoveryApplied = true;
    const rescued = buildSemanticOnlyHits(
      products,
      semanticRawHits,
      request.pageSize,
      Boolean(options.debug),
    );
    if (rescued.length > 0) {
      return {
        ...lexicalResult,
        hits: rescued,
        totalHits: rescued.length,
        totalPages: 1,
        processingTimeMs: Date.now() - started,
        rankingMode: "semantic_rescue",
        aiRankingDebug: {
          rankingMode: "semantic_rescue",
          lexicalWeight: config.weights.lexicalWeight,
          semanticWeight: config.weights.semanticWeight,
          personalizationWeight: config.weights.personalizationWeight,
          semanticHits,
          semanticRecoveryApplied: true,
          embeddingProvider: config.embeddingsProvider,
          embeddingModel: config.embeddingsModel,
          vectorIndexType: vectorConfig.indexType,
          rerankEnabled: rerankConfig.enabled,
          rerankProvider: rerankConfig.provider,
          experimentArm: options.experimentArm ?? undefined,
        },
        experimentArm: options.experimentArm ?? undefined,
      };
    }
  }

  const fused = fuseRetrievalCandidates({
    lexicalHits: semanticOnly ? [] : lexicalResult.hits,
    semanticHits: semanticRawHits,
  });

  const personalizationScoresRaw = options.sessionId
    ? await computePersonalizationScores(options.sessionId, products, config)
    : new Map<string, { score: number; codes: SearchExplanationCode[] }>();

  const personalizationScores = new Map<string, PersonalizationEntry>(
    [...personalizationScoresRaw.entries()].map(([id, entry]) => [id, entry]),
  );

  const effectiveRerankConfig =
    rerankPreview || rerankConfig.enabled ? { ...rerankConfig, enabled: true } : rerankConfig;

  const ranked = await unifiedRerankCandidates({
    query: request.query,
    fused,
    products,
    config,
    personalizationScores,
    rerankConfig: effectiveRerankConfig,
  });

  const productsById = new Map(products.map((product) => [product.id, product]));
  const mergedHits = rerankedToSearchHits(ranked, productsById, Boolean(options.debug));

  const pageOffset = (request.page - 1) * request.pageSize;
  const pagedHits = mergedHits.slice(pageOffset, pageOffset + request.pageSize);

  const rankingMode =
    options.previewMode ??
    (effectiveRerankConfig.enabled
      ? "hybrid_rerank"
      : config.personalizationEnabled
        ? "hybrid_personalization"
        : config.semanticRetrievalEnabled
          ? "hybrid"
          : "lexical");

  return {
    ...lexicalResult,
    hits: pagedHits,
    totalHits: mergedHits.length,
    totalPages: Math.ceil(mergedHits.length / request.pageSize),
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
      vectorIndexType: vectorConfig.indexType,
      rerankEnabled: effectiveRerankConfig.enabled,
      rerankProvider: effectiveRerankConfig.provider,
      fusedCandidateCount: fused.length,
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
