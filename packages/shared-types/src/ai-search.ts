import type { ISODateString, RankingDebugDto, SearchResponseDto } from "./index.js";

export type EmbeddingsProviderName = "mock" | "openai" | "openrouter";

export type AiSearchPreviewMode =
  | "lexical"
  | "hybrid"
  | "hybrid_personalization"
  | "semantic_rescue";

export type SearchExplanationCode =
  | "lexical_match"
  | "semantic_match"
  | "user_brand_affinity"
  | "user_category_affinity"
  | "user_product_affinity"
  | "merchandising_rule_applied"
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
  updatedAt?: ISODateString;
  updatedByUserId?: string;
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
  experimentArm?: "baseline" | "candidate";
}

export interface ExtendedRankingDebugDto extends RankingDebugDto {
  lexicalScore?: number;
  semanticScore?: number;
  personalizationScore?: number;
  explanationCodes?: SearchExplanationCode[];
}

export interface EmbeddingJobDto {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  jobType: "backfill" | "incremental" | "reindex";
  totalProducts: number;
  processedProducts: number;
  failedProducts: number;
  model: string;
  provider: EmbeddingsProviderName;
  errorMessage?: string;
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
}

export interface EmbeddingCoverageDto {
  totalProducts: number;
  embeddedProducts: number;
  coveragePercent: number;
  lastJob?: EmbeddingJobDto;
  model: string;
  provider: EmbeddingsProviderName;
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
