import type { LlmProvider, LlmProviderName } from "./types.js";
import { createGroqProvider } from "./providers/groq-provider.js";
import { createOpenRouterProvider } from "./providers/openrouter-provider.js";

export interface ProviderFactoryConfig {
  provider: LlmProviderName;
  model: string;
  timeoutMs: number;
  openRouterApiKey?: string;
  groqApiKey?: string;
}

export function createLlmProvider(config: ProviderFactoryConfig): LlmProvider | null {
  if (config.provider === "none") {
    return null;
  }

  if (config.provider === "openrouter") {
    if (!config.openRouterApiKey) {
      return null;
    }
    return createOpenRouterProvider({
      apiKey: config.openRouterApiKey,
      model: config.model,
      timeoutMs: config.timeoutMs,
    });
  }

  if (config.provider === "groq") {
    if (!config.groqApiKey) {
      return null;
    }
    return createGroqProvider({
      apiKey: config.groqApiKey,
      model: config.model,
      timeoutMs: config.timeoutMs,
    });
  }

  return null;
}

export function resolveDefaultModel(provider: LlmProviderName): string {
  switch (provider) {
    case "openrouter":
      return "meta-llama/llama-3.1-8b-instruct:free";
    case "groq":
      return "llama-3.1-8b-instant";
    default:
      return "none";
  }
}
