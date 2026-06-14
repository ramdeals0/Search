import type {
  AiRankingConfigDto,
  AiRankingWeightsDto,
  ExperimentArmAiConfigDto,
  UpdateAiRankingConfigRequestDto,
} from "@retailer-search/shared-types";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { recordAuditLog } from "../audit-trail-store.js";

const CONFIG_KEY = "ai.ranking.config";

const DEFAULT_WEIGHTS: AiRankingWeightsDto = {
  lexicalWeight: 0.55,
  semanticWeight: 0.3,
  personalizationWeight: 0.15,
};

function envBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  return value === "true";
}

function envNumber(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getDefaultAiRankingConfig(): AiRankingConfigDto {
  return {
    enabled: envBool("HYBRID_SEARCH_ENABLED", envBool("HYBRID_VECTOR_ENABLED", false)),
    semanticRetrievalEnabled: envBool("SEMANTIC_SEARCH_ENABLED", envBool("HYBRID_VECTOR_ENABLED", false)),
    personalizationEnabled: envBool("PERSONALIZATION_ENABLED", true),
    semanticZeroResultsFallbackEnabled: envBool(
      "SEMANTIC_ZERO_RESULTS_FALLBACK_ENABLED",
      true,
    ),
    semanticFallbackMinHits: envNumber("SEMANTIC_FALLBACK_MIN_HITS", 3),
    embeddingsProvider: (process.env.EMBEDDINGS_PROVIDER ?? "mock") as AiRankingConfigDto["embeddingsProvider"],
    embeddingsModel:
      process.env.EMBEDDINGS_MODEL ??
      (process.env.EMBEDDINGS_PROVIDER === "openai"
        ? "text-embedding-3-small"
        : "mock-hash-v1"),
    embeddingDimensions: envNumber("EMBEDDING_DIMENSIONS", 64),
    weights: {
      lexicalWeight:
        Number.parseFloat(process.env.LEXICAL_WEIGHT ?? "") || DEFAULT_WEIGHTS.lexicalWeight,
      semanticWeight:
        Number.parseFloat(process.env.SEMANTIC_WEIGHT ?? "") || DEFAULT_WEIGHTS.semanticWeight,
      personalizationWeight:
        Number.parseFloat(process.env.PERSONALIZATION_WEIGHT ?? "") ||
        DEFAULT_WEIGHTS.personalizationWeight,
    },
    personalizationLookbackDays: envNumber("PERSONALIZATION_LOOKBACK_DAYS", 30),
    personalizationDecayHalfLifeDays: envNumber(
      "PERSONALIZATION_DECAY_HALF_LIFE_DAYS",
      14,
    ),
    embeddingBatchSize: envNumber("EMBEDDING_BATCH_SIZE", 32),
    productEmbeddingsEnabled: envBool("PRODUCT_EMBEDDINGS_ENABLED", true),
  };
}

export function normalizeWeights(weights: Partial<AiRankingWeightsDto> | undefined): AiRankingWeightsDto {
  const lexicalWeight = weights?.lexicalWeight ?? DEFAULT_WEIGHTS.lexicalWeight;
  const semanticWeight = weights?.semanticWeight ?? DEFAULT_WEIGHTS.semanticWeight;
  const personalizationWeight =
    weights?.personalizationWeight ?? DEFAULT_WEIGHTS.personalizationWeight;
  const total = lexicalWeight + semanticWeight + personalizationWeight;
  if (total <= 0) {
    return { ...DEFAULT_WEIGHTS };
  }
  return {
    lexicalWeight: lexicalWeight / total,
    semanticWeight: semanticWeight / total,
    personalizationWeight: personalizationWeight / total,
  };
}

function mergeConfig(
  stored: Partial<AiRankingConfigDto> | null | undefined,
): AiRankingConfigDto {
  const defaults = getDefaultAiRankingConfig();
  if (!stored) {
    return defaults;
  }
  return {
    ...defaults,
    ...stored,
    weights: normalizeWeights({ ...defaults.weights, ...stored.weights }),
  };
}

export async function getAiRankingConfig(): Promise<AiRankingConfigDto> {
  const row = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
  return mergeConfig(row?.value as Partial<AiRankingConfigDto> | undefined);
}

export async function updateAiRankingConfig(
  request: UpdateAiRankingConfigRequestDto,
  actor?: { userId: string; email: string },
): Promise<AiRankingConfigDto> {
  const current = await getAiRankingConfig();
  const next: AiRankingConfigDto = {
    ...current,
    ...request,
    weights: normalizeWeights({ ...current.weights, ...request.weights }),
    updatedAt: new Date().toISOString(),
    updatedByUserId: actor?.userId,
  };

  await prisma.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value: next as unknown as Prisma.InputJsonValue },
    update: { value: next as unknown as Prisma.InputJsonValue },
  });

  recordAuditLog({
    actionType: "update_ai_ranking_config",
    entityType: "ai_ranking_config",
    entityId: CONFIG_KEY,
    outcome: "success",
    summary: `Updated AI ranking config by ${actor?.email ?? "system"}`,
    actorId: actor?.userId,
    actorLabel: actor?.email,
    metadata: { request },
  });

  return next;
}

export function mergeExperimentArmAiConfig(
  base: AiRankingConfigDto,
  armConfig?: ExperimentArmAiConfigDto | null,
): AiRankingConfigDto {
  if (!armConfig) {
    return base;
  }
  return {
    ...base,
    semanticRetrievalEnabled:
      armConfig.semanticRetrievalEnabled ?? base.semanticRetrievalEnabled,
    personalizationEnabled:
      armConfig.personalizationEnabled ?? base.personalizationEnabled,
    semanticZeroResultsFallbackEnabled:
      armConfig.semanticZeroResultsFallbackEnabled ??
      base.semanticZeroResultsFallbackEnabled,
    semanticFallbackMinHits:
      armConfig.semanticFallbackMinHits ?? base.semanticFallbackMinHits,
    embeddingsModel: armConfig.embeddingsModel ?? base.embeddingsModel,
    personalizationLookbackDays:
      armConfig.personalizationLookbackDays ?? base.personalizationLookbackDays,
    weights: normalizeWeights({ ...base.weights, ...armConfig.weights }),
  };
}

export function resolvePreviewModeConfig(
  base: AiRankingConfigDto,
  previewMode?: string,
): AiRankingConfigDto {
  switch (previewMode) {
    case "lexical":
      return {
        ...base,
        semanticRetrievalEnabled: false,
        personalizationEnabled: false,
        semanticZeroResultsFallbackEnabled: false,
      };
    case "hybrid":
      return {
        ...base,
        semanticRetrievalEnabled: true,
        personalizationEnabled: false,
      };
    case "hybrid_personalization":
      return {
        ...base,
        semanticRetrievalEnabled: true,
        personalizationEnabled: true,
      };
    case "semantic_rescue":
      return {
        ...base,
        semanticRetrievalEnabled: true,
        personalizationEnabled: false,
        semanticZeroResultsFallbackEnabled: true,
        semanticFallbackMinHits: Math.max(base.semanticFallbackMinHits, 1),
      };
    default:
      return base;
  }
}
