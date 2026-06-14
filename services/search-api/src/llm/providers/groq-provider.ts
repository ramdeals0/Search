import type { LlmProvider } from "../types.js";
import { OpenAiCompatibleClient } from "../openai-compatible-client.js";

export interface GroqProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export function createGroqProvider(options: GroqProviderOptions): LlmProvider {
  const client = new OpenAiCompatibleClient({
    provider: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: options.apiKey,
    model: options.model,
    timeoutMs: options.timeoutMs,
  });

  return {
    name: "groq",
    complete: (request) => client.complete(request),
  };
}
