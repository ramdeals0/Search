export type LlmProviderName = "openrouter" | "groq" | "none";

export interface LlmCredentialsStatusDto {
  openrouterConfigured: boolean;
  groqConfigured: boolean;
}

export interface LlmSettingsDto {
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
  providerReady: boolean;
  credentials: LlmCredentialsStatusDto;
  configuredInAdmin: boolean;
  updatedAt?: string;
  updatedByUserId?: string;
}

export interface UpdateLlmSettingsRequestDto {
  provider?: LlmProviderName;
  model?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  maxQueryChars?: number;
  rerankTopK?: number;
  debugLogging?: boolean;
  queryRewriteEnabled?: boolean;
  zeroResultsEnabled?: boolean;
  rerankEnabled?: boolean;
}
