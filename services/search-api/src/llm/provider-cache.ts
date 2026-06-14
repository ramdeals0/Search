import { createLlmProvider } from "./provider.js";
import type { LlmConfig } from "./types.js";

let cachedProviderKey = "";
let cachedProvider: ReturnType<typeof createLlmProvider> = null;

export function getCachedLlmProvider(config: LlmConfig) {
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

export function invalidateLlmProviderCache(): void {
  cachedProviderKey = "";
  cachedProvider = null;
}
