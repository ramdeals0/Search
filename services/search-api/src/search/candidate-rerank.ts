import type { SearchHitDto } from "@retailer-search/shared-types";
import type { LlmConfig, LlmProvider, RerankDebug } from "../llm/types.js";
import { buildRerankProductsPrompt } from "../llm/prompts/rerank-products.js";
import { rerankSchema } from "../llm/schemas/rerank-schema.js";
import {
  recordLlmCall,
  recordLlmFailure,
  recordRerankUsage,
} from "../llm/metrics/llm-metrics.js";
import { sanitizeQueryText, validateJsonPayload, validateRerankIds } from "../llm/parsing/validate.js";

export interface CandidateRerankResult {
  hits: SearchHitDto[];
  debug: RerankDebug;
}

export async function rerankCandidates(
  rawQuery: string,
  hits: SearchHitDto[],
  provider: LlmProvider | null,
  config: LlmConfig,
): Promise<CandidateRerankResult> {
  const topK = Math.max(1, Math.min(config.rerankTopK, hits.length));
  const candidates = hits.slice(0, topK);
  const tail = hits.slice(topK);

  const debug: RerankDebug = {
    applied: false,
    source: "skipped",
    topK,
    inputIds: candidates.map((hit) => hit.id),
  };

  if (!config.rerankEnabled || !provider || candidates.length <= 1) {
    return { hits, debug };
  }

  const query = sanitizeQueryText(rawQuery, config.maxQueryChars);
  if (!query) {
    return { hits, debug };
  }

  try {
    const completion = await provider.complete({
      messages: [
        {
          role: "system",
          content:
            "You rerank product search results by relevance. Respond with JSON only and never invent product ids.",
        },
        {
          role: "user",
          content: buildRerankProductsPrompt(query, candidates),
        },
      ],
      jsonMode: true,
      maxTokens: 400,
    });

    recordLlmCall(completion.latencyMs);

    const validated = validateJsonPayload(completion.content, rerankSchema);
    if (!validated.ok) {
      recordLlmFailure(validated.error);
      debug.source = "fallback";
      debug.error = validated.error;
      return { hits, debug };
    }

    const candidateIds = candidates.map((hit) => hit.id);
    const orderedIds = validateRerankIds(candidateIds, validated.data.rankedProductIds);
    if (!orderedIds) {
      debug.source = "fallback";
      debug.error = "invalid_rerank_ids";
      return { hits, debug };
    }

    const hitById = new Map(candidates.map((hit) => [hit.id, hit]));
    const rerankedTop = orderedIds
      .map((id) => hitById.get(id))
      .filter((hit): hit is SearchHitDto => Boolean(hit));

    recordRerankUsage();
    debug.applied = true;
    debug.source = "llm";
    debug.outputIds = orderedIds;

    if (config.debugLogging) {
      console.info("[llm] rerank", { query, orderedIds });
    }

    return {
      hits: [...rerankedTop, ...tail],
      debug,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "rerank_failed";
    recordLlmFailure(message);
    debug.source = "fallback";
    debug.error = message;
    return { hits, debug };
  }
}
