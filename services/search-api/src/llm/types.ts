export type LlmProviderName = "openrouter" | "groq" | "none";

export interface LlmChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCompletionRequest {
  messages: LlmChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LlmCompletionResponse {
  content: string;
  model: string;
  provider: LlmProviderName;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface LlmProvider {
  readonly name: LlmProviderName;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}

export interface QueryUnderstandingPayload {
  intent: string;
  rewrittenQuery: string;
  searchTerms: string[];
  categoryHint?: string;
  brandHint?: string;
  synonyms?: string[];
  confidence: number;
}

export interface QueryUnderstandingResult {
  ok: boolean;
  source: "cache" | "llm" | "fallback";
  data?: QueryUnderstandingPayload;
  error?: string;
  latencyMs?: number;
}

export interface ZeroResultsRewritePayload {
  rewrites: string[];
}

export interface ZeroResultsRecoveryDebug {
  attemptedRewrites: string[];
  successfulRewrite?: string;
  source: "llm" | "fallback" | "none";
}

export interface RerankPayload {
  rankedProductIds: string[];
}

export interface RerankDebug {
  applied: boolean;
  source: "llm" | "fallback" | "skipped";
  topK: number;
  inputIds: string[];
  outputIds?: string[];
  error?: string;
}

export interface LlmSearchDebugDto {
  retrievalQuery?: string;
  queryUnderstanding?: QueryUnderstandingResult;
  zeroResultsRecovery?: ZeroResultsRecoveryDebug;
  rerank?: RerankDebug;
}

export type EnhancedSearchResponseDto = import("@retailer-search/shared-types").SearchResponseDto & {
  llmDebug?: LlmSearchDebugDto;
};

export interface LlmConfig {
  provider: LlmProviderName;
  model: string;
  timeoutMs: number;
  cacheTtlMs: number;
  maxQueryChars: number;
  rerankTopK: number;
  debugLogging: boolean;
  queryRewriteEnabled: boolean;
  zeroResultsEnabled: boolean;
  rerankEnabled: boolean;
}
