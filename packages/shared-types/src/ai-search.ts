import type { ISODateString, RankingDebugDto, SearchResponseDto } from "./index.js";

export type EmbeddingsProviderName = "mock" | "openai" | "openrouter";

export type AiSearchPreviewMode =
  | "lexical"
  | "semantic"
  | "hybrid"
  | "hybrid_rerank"
  | "hybrid_personalization"
  | "semantic_rescue";

export type LiveRankingMode =
  | "lexical"
  | "hybrid"
  | "hybrid_personalization"
  | "hybrid_rerank";

export type SearchExplanationCode =
  | "lexical_match"
  | "semantic_match"
  | "user_brand_affinity"
  | "user_category_affinity"
  | "user_product_affinity"
  | "merchandising_rule_applied"
  | "in_stock_boost"
  | "profit_margin_boost"
  | "zero_results_semantic_recovery"
  | "personalization_rerank";

export interface AiRankingWeightsDto {
  lexicalWeight: number;
  semanticWeight: number;
  personalizationWeight: number;
}

export interface AiRankingConfigDto {
  enabled: boolean;
  semanticRetrievalEnabled: boolean;
  personalizationEnabled: boolean;
  semanticZeroResultsFallbackEnabled: boolean;
  semanticFallbackMinHits: number;
  embeddingsProvider: EmbeddingsProviderName;
  embeddingsModel: string;
  embeddingDimensions: number;
  weights: AiRankingWeightsDto;
  personalizationLookbackDays: number;
  personalizationDecayHalfLifeDays: number;
  embeddingBatchSize: number;
  productEmbeddingsEnabled: boolean;
  /** Effective ranking mode for live storefront search (computed server-side). */
  liveRankingMode?: LiveRankingMode;
  /** Whether the configured provider can run (API key present when required). */
  embeddingsProviderReady?: boolean;
  /** Provider actually used for embedding calls (may fall back to mock). */
  effectiveEmbeddingsProvider?: EmbeddingsProviderName;
  embeddingCredentials?: EmbeddingCredentialsStatusDto;
  updatedAt?: ISODateString;
  updatedByUserId?: string;
}

export interface EmbeddingCredentialsStatusDto {
  openrouterConfigured: boolean;
  openaiConfigured: boolean;
  embeddingsApiKeyConfigured: boolean;
}

export interface UpdateAiRankingConfigRequestDto {
  enabled?: boolean;
  semanticRetrievalEnabled?: boolean;
  personalizationEnabled?: boolean;
  semanticZeroResultsFallbackEnabled?: boolean;
  semanticFallbackMinHits?: number;
  embeddingsProvider?: EmbeddingsProviderName;
  embeddingsModel?: string;
  embeddingDimensions?: number;
  weights?: Partial<AiRankingWeightsDto>;
  personalizationLookbackDays?: number;
  personalizationDecayHalfLifeDays?: number;
  embeddingBatchSize?: number;
  productEmbeddingsEnabled?: boolean;
}

export interface ExperimentArmAiConfigDto {
  semanticRetrievalEnabled?: boolean;
  personalizationEnabled?: boolean;
  semanticZeroResultsFallbackEnabled?: boolean;
  embeddingsModel?: string;
  weights?: Partial<AiRankingWeightsDto>;
  semanticFallbackMinHits?: number;
  personalizationLookbackDays?: number;
}

export interface AiRankingDebugDto {
  rankingMode: AiSearchPreviewMode | "live";
  lexicalWeight: number;
  semanticWeight: number;
  personalizationWeight: number;
  semanticHits: number;
  semanticRecoveryApplied: boolean;
  embeddingProvider: EmbeddingsProviderName;
  embeddingModel: string;
  vectorIndexType?: "hnsw" | "ivfflat" | "none";
  rerankEnabled?: boolean;
  rerankProvider?: "off" | "score_fusion" | "cross_encoder" | "llm";
  fusedCandidateCount?: number;
  experimentArm?: "baseline" | "candidate";
}

export interface ExtendedRankingDebugDto extends RankingDebugDto {
  lexicalScore?: number;
  semanticScore?: number;
  personalizationScore?: number;
  fusedScore?: number;
  rerankScore?: number;
  retrievalSources?: Array<"lexical" | "semantic">;
  explanationCodes?: SearchExplanationCode[];
}

export interface EmbeddingJobDto {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "dead_letter";
  jobType: "backfill" | "incremental" | "reindex" | "consistency_scan";
  totalProducts: number;
  processedProducts: number;
  failedProducts: number;
  skippedProducts?: number;
  model: string;
  provider: EmbeddingsProviderName;
  errorMessage?: string;
  retryCount?: number;
  maxRetries?: number;
  startedAt?: ISODateString;
  completedAt?: ISODateString;
  createdAt: ISODateString;
}

export interface EmbeddingJobListResponseDto {
  total: number;
  jobs: EmbeddingJobDto[];
}

export interface TriggerEmbeddingJobRequestDto {
  jobType?: "backfill" | "incremental" | "reindex";
  productIds?: string[];
  /** Abandon any queued/running catalog job and queue a fresh one. */
  restart?: boolean;
}

export interface EmbeddingCoverageDto {
  totalProducts: number;
  embeddedProducts: number;
  coveragePercent: number;
  lastJob?: EmbeddingJobDto;
  model: string;
  provider: EmbeddingsProviderName;
  effectiveProvider?: EmbeddingsProviderName;
  providerReady?: boolean;
}

export interface AiSearchResponseDto extends SearchResponseDto {
  rankingMode?: AiSearchPreviewMode | "live";
  aiRankingDebug?: AiRankingDebugDto;
  hits: Array<
    SearchResponseDto["hits"][number] & {
      rankingDebug?: ExtendedRankingDebugDto;
    }
  >;
}

export interface AiQueryPreviewRequestDto {
  query: string;
  pageSize?: number;
  environment?: "staging" | "live";
  previewMode?: AiSearchPreviewMode;
  sessionId?: string;
}

export interface AiQueryPreviewResponseDto {
  query: string;
  previewMode: AiSearchPreviewMode;
  rankingMode?: AiSearchPreviewMode | LiveRankingMode;
  total: number;
  appliedRuleNames: string[];
  aiRankingDebug?: AiRankingDebugDto;
  hits: Array<{
    id: string;
    title: string;
    brand: string;
    category: string;
    score: number;
    inStock: boolean;
    rankingDebug?: ExtendedRankingDebugDto;
  }>;
}
