import type {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmProviderName,
} from "./types.js";

export interface OpenAiCompatibleClientOptions {
  provider: LlmProviderName;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  defaultHeaders?: Record<string, string>;
}

interface ChatCompletionApiResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: { message?: string };
}

export class OpenAiCompatibleClient {
  constructor(private readonly options: OpenAiCompatibleClientOptions) {}

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model: this.options.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.1,
        max_tokens: request.maxTokens ?? 512,
      };

      if (request.jsonMode) {
        body.response_format = { type: "json_object" };
      }

      const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.options.apiKey}`,
          ...this.options.defaultHeaders,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const payload = (await response.json()) as ChatCompletionApiResponse;

      if (!response.ok) {
        throw new Error(payload.error?.message ?? `LLM HTTP ${response.status}`);
      }

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("LLM returned empty content");
      }

      return {
        content,
        model: payload.model ?? this.options.model,
        provider: this.options.provider,
        latencyMs: Date.now() - started,
        promptTokens: payload.usage?.prompt_tokens,
        completionTokens: payload.usage?.completion_tokens,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
