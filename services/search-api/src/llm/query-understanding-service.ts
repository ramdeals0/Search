import type {
  LlmConfig,
  LlmProvider,
  QueryUnderstandingPayload,
  QueryUnderstandingResult,
} from "./types.js";
import { LlmCache } from "./cache/llm-cache.js";
import {
  recordLlmCacheHit,
  recordLlmCall,
  recordLlmFailure,
  recordRewriteUsage,
} from "./metrics/llm-metrics.js";
import { buildQueryUnderstandingPrompt } from "./prompts/query-understanding.js";
import { queryUnderstandingSchema } from "./schemas/query-understanding-schema.js";
import {
  isAdvisoryRewriteAllowed,
  sanitizeQueryText,
  validateJsonPayload,
} from "./parsing/validate.js";
import { normalizeSearchQuery } from "../search/query-normalization.js";

let cacheTtlMs = 300_000;
let understandingCache = new LlmCache<QueryUnderstandingPayload>(cacheTtlMs);

function getUnderstandingCache(ttlMs: number): LlmCache<QueryUnderstandingPayload> {
  if (ttlMs !== cacheTtlMs) {
    cacheTtlMs = ttlMs;
    understandingCache = new LlmCache<QueryUnderstandingPayload>(ttlMs);
  }
  return understandingCache;
}

export async function understandQuery(
  rawQuery: string,
  provider: LlmProvider | null,
  config: LlmConfig,
): Promise<QueryUnderstandingResult> {
  const query = sanitizeQueryText(rawQuery, config.maxQueryChars);
  if (!query) {
    return { ok: false, source: "fallback", error: "empty_query" };
  }

  if (!config.queryRewriteEnabled || !provider) {
    return { ok: false, source: "fallback", error: "feature_disabled" };
  }

  const cacheKey = normalizeSearchQuery(query);
  const cache = getUnderstandingCache(config.cacheTtlMs);
  const cached = cache.get(cacheKey);
  if (cached) {
    recordLlmCacheHit();
    return { ok: true, source: "cache", data: cached };
  }

  try {
    const completion = await provider.complete({
      messages: [
        {
          role: "system",
          content:
            "You are a search query understanding engine for an e-commerce catalog. Respond with JSON only.",
        },
        {
          role: "user",
          content: buildQueryUnderstandingPrompt(query),
        },
      ],
      jsonMode: true,
      maxTokens: 400,
    });

    recordLlmCall(completion.latencyMs);

    const validated = validateJsonPayload(completion.content, queryUnderstandingSchema);
    if (!validated.ok) {
      recordLlmFailure(validated.error);
      return { ok: false, source: "fallback", error: validated.error };
    }

    const payload: QueryUnderstandingPayload = {
      intent: validated.data.intent.trim(),
      rewrittenQuery: validated.data.rewrittenQuery.trim(),
      searchTerms: validated.data.searchTerms.map((term) => term.trim()).filter(Boolean),
      categoryHint: validated.data.categoryHint?.trim() || undefined,
      brandHint: validated.data.brandHint?.trim() || undefined,
      synonyms: validated.data.synonyms?.map((term) => term.trim()).filter(Boolean),
      confidence: validated.data.confidence,
    };

    if (
      !isAdvisoryRewriteAllowed(query, payload.rewrittenQuery, 0.55, payload.confidence)
    ) {
      return {
        ok: false,
        source: "fallback",
        error: "rewrite_rejected_by_policy",
        latencyMs: completion.latencyMs,
      };
    }

    cache.set(cacheKey, payload);
    recordRewriteUsage();

    if (config.debugLogging) {
      console.info("[llm] query understanding", { query, payload });
    }

    return {
      ok: true,
      source: "llm",
      data: payload,
      latencyMs: completion.latencyMs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "query_understanding_failed";
    recordLlmFailure(message);
    return { ok: false, source: "fallback", error: message };
  }
}

export function getUnderstandingCacheSize(): number {
  return understandingCache.size();
}