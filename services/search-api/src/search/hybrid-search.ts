import type {
  MerchandisingRule,
  ProductDocument,
  SearchRequestDto,
  SearchResponseDto,
} from "@retailer-search/shared-types";
import type { ProductSearchIndex, QueryProcessorConfig } from "@retailer-search/search-core";
import { getAiRankingConfig } from "../ai-search/ai-ranking-config-store.js";
import { executeHybridRankingPipeline } from "../ai-search/hybrid-ranking-pipeline.js";

export interface HybridSearchOptions {
  rules?: MerchandisingRule[];
  debug?: boolean;
  index?: ProductSearchIndex;
  queryProcessorConfig?: QueryProcessorConfig;
  vectorWeight?: number;
  sessionId?: string;
}

export async function hybridSearchProducts(
  products: ProductDocument[],
  request: SearchRequestDto,
  options: HybridSearchOptions = {},
): Promise<SearchResponseDto> {
  const config = await getAiRankingConfig();
  if (options.vectorWeight !== undefined) {
    config.weights.semanticWeight = options.vectorWeight;
  }
  return executeHybridRankingPipeline(products, request, {
    rules: options.rules,
    debug: options.debug,
    index: options.index,
    queryProcessorConfig: options.queryProcessorConfig,
    config,
    sessionId: options.sessionId,
  });
}
