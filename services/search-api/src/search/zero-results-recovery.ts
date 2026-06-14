import { searchProducts } from "@retailer-search/search-core";
import type {
  MerchandisingRule,
  ProductDocument,
  SearchRequestDto,
  SearchResponseDto,
} from "@retailer-search/shared-types";
import type { LlmConfig, LlmProvider, ZeroResultsRecoveryDebug } from "../llm/types.js";
import { buildZeroResultsRewritePrompt } from "../llm/prompts/zero-results-rewrite.js";
import { zeroResultsRewriteSchema } from "../llm/schemas/query-understanding-schema.js";
import {
  recordLlmCall,
  recordLlmFailure,
  recordZeroResultRecoveryAttempt,
  recordZeroResultRecoverySuccess,
} from "../llm/metrics/llm-metrics.js";
import { sanitizeQueryText, validateJsonPayload } from "../llm/parsing/validate.js";

export interface ZeroResultsRecoveryOptions {
  products: ProductDocument[];
  request: SearchRequestDto;
  rules: MerchandisingRule[];
  debug?: boolean;
}

export interface ZeroResultsRecoveryResult {
  result: SearchResponseDto | null;
  debug: ZeroResultsRecoveryDebug;
}

function padRewrites(rewrites: string[]): string[] {
  return rewrites.slice(0, 3);
}

export async function recoverZeroResults(
  rawQuery: string,
  provider: LlmProvider | null,
  config: LlmConfig,
  options: ZeroResultsRecoveryOptions,
): Promise<ZeroResultsRecoveryResult> {
  const debug: ZeroResultsRecoveryDebug = {
    attemptedRewrites: [],
    source: "none",
  };

  if (!config.zeroResultsEnabled || !provider) {
    return { result: null, debug };
  }

  const query = sanitizeQueryText(rawQuery, config.maxQueryChars);
  if (!query) {
    return { result: null, debug };
  }

  recordZeroResultRecoveryAttempt();

  try {
    const completion = await provider.complete({
      messages: [
        {
          role: "system",
          content:
            "You rewrite failed e-commerce queries into broader catalog searches. Respond with JSON only.",
        },
        {
          role: "user",
          content: buildZeroResultsRewritePrompt(query),
        },
      ],
      jsonMode: true,
      maxTokens: 300,
    });

    recordLlmCall(completion.latencyMs);

    const validated = validateJsonPayload(completion.content, zeroResultsRewriteSchema);
    if (!validated.ok) {
      recordLlmFailure(validated.error);
      debug.source = "fallback";
      return { result: null, debug };
    }

    const rewrites = padRewrites(
      validated.data.rewrites.map((rewrite) => rewrite.trim()).filter(Boolean),
    );
    debug.attemptedRewrites = rewrites;
    debug.source = "llm";

    for (const rewrite of rewrites) {
      const attempt = searchProducts(
        options.products,
        { ...options.request, query: rewrite, page: 1 },
        { rules: options.rules, debug: options.debug ?? false },
      );

      if (attempt.totalHits > 0) {
        recordZeroResultRecoverySuccess();
        debug.successfulRewrite = rewrite;

        if (config.debugLogging) {
          console.info("[llm] zero-results recovery", { query, rewrite, totalHits: attempt.totalHits });
        }

        return { result: attempt, debug };
      }
    }

    return { result: null, debug };
  } catch (error) {
    const message = error instanceof Error ? error.message : "zero_results_recovery_failed";
    recordLlmFailure(message);
    debug.source = "fallback";
    return { result: null, debug };
  }
}
