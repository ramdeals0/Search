import type { LlmProvider } from "../types.js";
import { OpenAiCompatibleClient } from "../openai-compatible-client.js";

export interface OpenRouterProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export function createOpenRouterProvider(
  options: OpenRouterProviderOptions,
): LlmProvider {
  const client = new OpenAiCompatibleClient({
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: options.apiKey,
    model: options.model,
    timeoutMs: options.timeoutMs,
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_REFERER ?? "https://retailer-search-platform.local",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Retailer Search Platform",
    },
  });

  return {
    name: "openrouter",
    complete: (request) => client.complete(request),
  };
}
