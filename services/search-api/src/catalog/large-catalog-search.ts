import type {
  MerchandisingRule,
  ProductDocument,
  SearchRequestDto,
  SearchResponseDto,
} from "@retailer-search/shared-types";
import {
  searchProducts,
  type ProductSearchIndex,
  type QueryProcessorConfig,
} from "@retailer-search/search-core";
import { executeHybridRankingPipeline } from "../ai-search/hybrid-ranking-pipeline.js";
import type { AiRankingConfigDto } from "@retailer-search/shared-types";
import { fetchSearchCandidatesFromDatabase } from "./catalog-db-queries.js";
import { CATALOG_SEARCH_CANDIDATE_LIMIT } from "./catalog-scale-config.js";

export interface LargeCatalogSearchOptions {
  catalogId?: string;
  rules?: MerchandisingRule[];
  debug?: boolean;
  index?: ProductSearchIndex;
  queryProcessorConfig?: QueryProcessorConfig;
  config?: AiRankingConfigDto;
  sessionId?: string;
  experimentArm?: "baseline" | "candidate" | null;
  useHybrid?: boolean;
}

export async function searchLargeCatalog(
  request: SearchRequestDto,
  options: LargeCatalogSearchOptions = {},
): Promise<SearchResponseDto> {
  const candidates = await fetchSearchCandidatesFromDatabase({
    query: request.query,
    catalogId: options.catalogId,
    filters: request.filters,
    limit: CATALOG_SEARCH_CANDIDATE_LIMIT,
  });

  if (options.useHybrid && options.config) {
    return executeHybridRankingPipeline(candidates, request, {
      rules: options.rules,
      debug: options.debug,
      index: options.index,
      queryProcessorConfig: options.queryProcessorConfig,
      config: options.config,
      sessionId: options.sessionId,
      experimentArm: options.experimentArm,
    });
  }

  return searchProducts(candidates, request, {
    rules: options.rules,
    debug: options.debug,
    index: options.index,
    queryProcessorConfig: options.queryProcessorConfig,
  });
}

export async function resolveSearchCandidates(
  request: SearchRequestDto,
  catalogId?: string,
  inMemoryCatalog?: ProductDocument[],
): Promise<ProductDocument[]> {
  if (inMemoryCatalog && inMemoryCatalog.length > 0) {
    return inMemoryCatalog;
  }

  return fetchSearchCandidatesFromDatabase({
    query: request.query,
    catalogId,
    filters: request.filters,
    limit: CATALOG_SEARCH_CANDIDATE_LIMIT,
  });
}
