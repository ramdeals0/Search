import type { TriggerEmbeddingJobRequestDto } from "@retailer-search/shared-types";
import { prisma } from "../db.js";
import { getEmbeddingWorkerRuntimeConfig } from "../ai-search/vector-config.js";
import { getAiRankingConfig } from "../ai-search/ai-ranking-config-store.js";

const prismaClient = prisma as any;

export interface ClaimedEmbeddingJob {
  id: string;
  jobType: string;
  productIds?: string[];
  retryCount: number;
  maxRetries: number;
  model: string;
  provider: string;
}

function parseProductIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const ids = value.filter((entry): entry is string => typeof entry === "string");
  return ids.length > 0 ? ids : undefined;
}

/** Claim next job with PostgreSQL SKIP LOCKED (safe for multiple Railway worker replicas). */
export async function claimNextEmbeddingJob(
  workerId: string,
  lockTimeoutMs: number,
): Promise<ClaimedEmbeddingJob | null> {
  const staleBefore = new Date(Date.now() - lockTimeoutMs);

  const rows = (await prisma.$queryRawUnsafe(
    `
    UPDATE "EmbeddingJob"
    SET
      status = 'running',
      "lockedAt" = NOW(),
      "lockedBy" = $1,
      "startedAt" = COALESCE("startedAt", NOW()),
      "updatedAt" = NOW()
    WHERE id = (
      SELECT id
      FROM "EmbeddingJob"
      WHERE (
        status = 'queued'
        OR (
          status = 'running'
          AND "lockedAt" IS NOT NULL
          AND "lockedAt" < $2
        )
      )
      AND ("nextRunAt" IS NULL OR "nextRunAt" <= NOW())
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, "jobType", "productIds", "retryCount", "maxRetries", model, provider
    `,
    workerId,
    staleBefore,
  )) as Array<{
    id: string;
    jobType: string;
    productIds: unknown;
    retryCount: number;
    maxRetries: number;
    model: string;
    provider: string;
  }>;

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    jobType: row.jobType,
    productIds: parseProductIds(row.productIds),
    retryCount: row.retryCount,
    maxRetries: row.maxRetries,
    model: row.model,
    provider: row.provider,
  };
}

export async function completeEmbeddingJob(
  jobId: string,
  stats: {
    processedProducts: number;
    failedProducts: number;
    skippedProducts: number;
  },
): Promise<void> {
  await prismaClient.embeddingJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      processedProducts: stats.processedProducts,
      failedProducts: stats.failedProducts,
      skippedProducts: stats.skippedProducts,
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      errorMessage: null,
    },
  });
}

export async function failEmbeddingJob(
  jobId: string,
  errorMessage: string,
  stats: {
    processedProducts: number;
    failedProducts: number;
    skippedProducts: number;
    retryCount: number;
    maxRetries: number;
  },
): Promise<void> {
  const nextRetry = stats.retryCount + 1;
  const canRetry = nextRetry < stats.maxRetries;
  const backoffMs = Math.min(60_000, 1000 * 2 ** nextRetry);

  await prismaClient.embeddingJob.update({
    where: { id: jobId },
    data: {
      status: canRetry ? "queued" : "dead_letter",
      retryCount: nextRetry,
      processedProducts: stats.processedProducts,
      failedProducts: stats.failedProducts,
      skippedProducts: stats.skippedProducts,
      errorMessage,
      completedAt: canRetry ? null : new Date(),
      nextRunAt: canRetry ? new Date(Date.now() + backoffMs) : null,
      lockedAt: null,
      lockedBy: null,
    },
  });
}

export async function enqueueEmbeddingJob(
  request: TriggerEmbeddingJobRequestDto = {},
  totalProducts: number,
): Promise<{ id: string }> {
  const config = await getAiRankingConfig();
  const workerConfig = getEmbeddingWorkerRuntimeConfig();

  const row = await prismaClient.embeddingJob.create({
    data: {
      status: "queued",
      jobType: request.jobType ?? "backfill",
      totalProducts,
      model: config.embeddingsModel,
      provider: config.embeddingsProvider,
      maxRetries: workerConfig.maxRetries,
      productIds: request.productIds?.length ? request.productIds : undefined,
    },
  });

  return { id: row.id };
}

export async function enqueueIncrementalEmbeddingJobs(
  productIds: string[],
): Promise<void> {
  if (productIds.length === 0) {
    return;
  }
  const config = await getAiRankingConfig();
  if (!config.productEmbeddingsEnabled) {
    return;
  }

  const workerConfig = getEmbeddingWorkerRuntimeConfig();
  await prismaClient.embeddingJob.create({
    data: {
      status: "queued",
      jobType: "incremental",
      totalProducts: productIds.length,
      model: config.embeddingsModel,
      provider: config.embeddingsProvider,
      maxRetries: workerConfig.maxRetries,
      productIds,
    },
  });
}
