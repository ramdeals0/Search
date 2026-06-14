import { searchProducts } from "@retailer-search/search-core";
import type {
  MerchandisingRule,
  ProductDocument,
  SearchRequestDto,
} from "@retailer-search/shared-types";
import { createLlmProvider } from "../llm/provider.js";
import type { EnhancedSearchResponseDto, LlmSearchDebugDto } from "../llm/types.js";
import { understandQuery } from "../llm/query-understanding-service.js";
import { buildRetrievalQuery } from "./query-normalization.js";
import { getSearchFeatureFlags } from "./search-feature-flags.js";
import { recoverZeroResults } from "./zero-results-recovery.js";
import { rerankCandidates } from "./candidate-rerank.js";

export interface LlmEnhancedSearchOptions {
  rules: MerchandisingRule[];
  debug?: boolean;
  index?: import("@retailer-search/search-core").ProductSearchIndex;
  queryProcessorConfig?: import("@retailer-search/search-core").QueryProcessorConfig;
}

let cachedProviderKey = "";
let cachedProvider: ReturnType<typeof createLlmProvider> = null;

function getProvider(config = getSearchFeatureFlags()) {
  const key = [
    config.provider,
    config.model,
    config.timeoutMs,
    process.env.OPENROUTER_API_KEY ?? "",
    process.env.GROQ_API_KEY ?? "",
  ].join("|");

  if (key !== cachedProviderKey) {
    cachedProviderKey = key;
    cachedProvider = createLlmProvider({
      provider: config.provider,
      model: config.model,
      timeoutMs: config.timeoutMs,
      openRouterApiKey: process.env.OPENROUTER_API_KEY,
      groqApiKey: process.env.GROQ_API_KEY,
    });
  }

  return cachedProvider;
}

export async function llmEnhancedSearch(
  products: ProductDocument[],
  request: SearchRequestDto,
  options: LlmEnhancedSearchOptions,
): Promise<EnhancedSearchResponseDto> {
  const config = getSearchFeatureFlags();
  const provider = getProvider(config);
  const llmDebug: LlmSearchDebugDto = {};
  const started = Date.now();

  let retrievalQuery = request.query;
  let understandingApplied = false;

  if (config.queryRewriteEnabled) {
    const understanding = await understandQuery(request.query, provider, config);
    llmDebug.queryUnderstanding = understanding;

    if (understanding.ok && understanding.data?.rewrittenQuery) {
      retrievalQuery = buildRetrievalQuery(
        request.query,
        understanding.data.rewrittenQuery,
      );
      understandingApplied = retrievalQuery !== request.query.trim();
    }
  }

  llmDebug.retrievalQuery = retrievalQuery;

  let result = searchProducts(
    products,
    { ...request, query: retrievalQuery },
    {
      rules: options.rules,
      debug: options.debug ?? false,
      index: options.index,
      queryProcessorConfig: options.queryProcessorConfig,
    },
  );

  if (result.totalHits === 0 && config.zeroResultsEnabled) {
    const recovery = await recoverZeroResults(request.query, provider, config, {
      products,
      request,
      rules: options.rules,
      debug: options.debug,
    });

    llmDebug.zeroResultsRecovery = recovery.debug;

    if (recovery.result) {
      result = {
        ...recovery.result,
        query: request.query,
        normalizedQuery: result.normalizedQuery,
        correctedQuery: result.correctedQuery,
        page: request.page,
        pageSize: request.pageSize,
        totalPages: Math.max(1, Math.ceil(recovery.result.totalHits / request.pageSize)),
        hits: recovery.result.hits.slice(
          (request.page - 1) * request.pageSize,
          request.page * request.pageSize,
        ),
      };
      if (recovery.debug.successfulRewrite) {
        llmDebug.retrievalQuery = recovery.debug.successfulRewrite;
      }
    }
  }

  if (config.rerankEnabled && result.totalHits > 0 && request.page === 1) {
    const rerankWindow = searchProducts(
      products,
      {
        ...request,
        query: llmDebug.retrievalQuery ?? retrievalQuery,
        page: 1,
        pageSize: Math.max(request.pageSize, config.rerankTopK),
      },
      {
        rules: options.rules,
        debug: options.debug ?? false,
        index: options.index,
        queryProcessorConfig: options.queryProcessorConfig,
      },
    );

    const reranked = await rerankCandidates(
      request.query,
      rerankWindow.hits.slice(0, config.rerankTopK),
      provider,
      config,
    );

    llmDebug.rerank = reranked.debug;

    if (reranked.debug.applied) {
      const mergedHits = [
        ...reranked.hits,
        ...rerankWindow.hits.slice(config.rerankTopK),
      ];
      result = {
        ...result,
        hits: mergedHits.slice(0, request.pageSize),
      };
    }
  }

  result.processingTimeMs = Date.now() - started;

  const response: EnhancedSearchResponseDto = {
    ...result,
    query: request.query,
  };

  if (understandingApplied && llmDebug.queryUnderstanding?.data?.rewrittenQuery) {
    response.normalizedQuery = llmDebug.queryUnderstanding.data.rewrittenQuery;
  }

  if (options.debug) {
    response.llmDebug = llmDebug;
  }

  return response;
}

export async function debugQueryUnderstanding(query: string) {
  const config = getSearchFeatureFlags();
  const provider = getProvider(config);
  return understandQuery(query, provider, {
    ...config,
    queryRewriteEnabled: true,
  });
}
