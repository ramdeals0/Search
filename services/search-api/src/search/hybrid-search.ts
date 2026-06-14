import {
  mergeHybridScores,
  NoopVectorSearchProvider,
  searchProducts,
  type ProductSearchIndex,
  type QueryProcessorConfig,
} from "@retailer-search/search-core";
import type {
  MerchandisingRule,
  ProductDocument,
  SearchRequestDto,
  SearchResponseDto,
} from "@retailer-search/shared-types";

const vectorProvider = new NoopVectorSearchProvider();

export interface HybridSearchOptions {
  rules?: MerchandisingRule[];
  debug?: boolean;
  index?: ProductSearchIndex;
  queryProcessorConfig?: QueryProcessorConfig;
  vectorWeight?: number;
}

export async function hybridSearchProducts(
  products: ProductDocument[],
  request: SearchRequestDto,
  options: HybridSearchOptions = {},
): Promise<SearchResponseDto & { hybridDebug?: { vectorHits: number; vectorWeight: number } }> {
  const keywordResult = searchProducts(products, request, options);
  const vectorHits = await vectorProvider.search(request.query, request.pageSize);
  const vectorWeight = options.vectorWeight ?? 0.25;

  if (vectorHits.length === 0) {
    return {
      ...keywordResult,
      hybridDebug: { vectorHits: 0, vectorWeight },
    };
  }

  const vectorScoreById = new Map(
    vectorHits.map((hit) => [hit.productId, hit.score]),
  );

  const mergedHits = keywordResult.hits.map((hit) => {
    const vectorScore = vectorScoreById.get(hit.id) ?? 0;
    return {
      ...hit,
      score: mergeHybridScores(hit.score, vectorScore, vectorWeight),
    };
  });

  mergedHits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return {
    ...keywordResult,
    hits: mergedHits,
    hybridDebug: {
      vectorHits: vectorHits.length,
      vectorWeight,
    },
  };
}
