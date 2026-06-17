import type {
  EmbeddingCoverageDto,
  EmbeddingJobDto,
  EmbeddingsProviderName,
  TriggerEmbeddingJobRequestDto,
} from "@retailer-search/shared-types";
import type { ProductDocument } from "@retailer-search/shared-types";
import { prisma } from "../db.js";
import {
  countAllProductsInDatabase,
  forEachProductBatchFromDatabase,
} from "../catalog/catalog-db-queries.js";
import { CATALOG_DB_BATCH_SIZE } from "../catalog/catalog-scale-config.js";
import { isLargeCatalogMode } from "../catalog-store.js";
import { getAiRankingConfig } from "./ai-ranking-config-store.js";
import {
  cancelEmbeddingJobs,
  clearEmbeddingJobCancellation,
  completeEmbeddingJobInline,
  failEmbeddingJobInline,
  getActiveInlineJobId,
  markEmbeddingJobRunning,
  setActiveInlineJobId,
  shouldContinueEmbeddingJob,
  touchEmbeddingJobLock,
  updateEmbeddingJobProgress,
} from "./embedding-job-runtime.js";
import {
  enqueueEmbeddingJob,
  enqueueIncrementalEmbeddingJobs,
} from "./embedding-job-queue.js";
import { embedProductsBatch, getEmbeddingCoverage, hydrateVectorIndex } from "./vector-index.js";
import { getEmbeddingProviderStatus } from "./embedding-provider.js";
import { getEmbeddingWorkerRuntimeConfig } from "./vector-config.js";

const prismaClient = prisma as any;

function toDto(row: {
  id: string;
  status: string;
  jobType: string;
  totalProducts: number;
  processedProducts: number;
  failedProducts: number;
  skippedProducts?: number;
  model: string;
  provider: string;
  errorMessage: string | null;
  retryCount?: number;
  maxRetries?: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}): EmbeddingJobDto {
  return {
    id: row.id,
    status: row.status as EmbeddingJobDto["status"],
    jobType: row.jobType as EmbeddingJobDto["jobType"],
    totalProducts: row.totalProducts,
    processedProducts: row.processedProducts,
    failedProducts: row.failedProducts,
    skippedProducts: row.skippedProducts ?? 0,
    model: row.model,
    provider: row.provider as EmbeddingsProviderName,
    errorMessage: row.errorMessage ?? undefined,
    retryCount: row.retryCount,
    maxRetries: row.maxRetries,
    startedAt: row.startedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listEmbeddingJobs(limit = 20): Promise<EmbeddingJobDto[]> {
  const rows = await prismaClient.embeddingJob.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toDto);
}

export async function getEmbeddingJob(id: string): Promise<EmbeddingJobDto | null> {
  const row = await prismaClient.embeddingJob.findUnique({ where: { id } });
  return row ? toDto(row) : null;
}

async function findActiveCatalogEmbeddingJob(): Promise<EmbeddingJobDto | null> {
  await abandonStaleCatalogEmbeddingJobs();

  const row = await prismaClient.embeddingJob.findFirst({
    where: {
      status: { in: ["queued", "running"] },
      jobType: { in: ["backfill", "reindex", "consistency_scan"] },
    },
    orderBy: { createdAt: "desc" },
  });
  return row ? toDto(row) : null;
}

async function abandonStaleCatalogEmbeddingJobs(): Promise<void> {
  const workerConfig = getEmbeddingWorkerRuntimeConfig();
  const staleBefore = new Date(Date.now() - workerConfig.lockTimeoutMs);
  const inlineJobId = getActiveInlineJobId();

  await prismaClient.embeddingJob.updateMany({
    where: {
      status: "running",
      jobType: { in: ["backfill", "reindex", "consistency_scan"] },
      updatedAt: { lt: staleBefore },
      ...(inlineJobId ? { id: { not: inlineJobId } } : {}),
    },
    data: {
      status: "failed",
      errorMessage:
        "Job abandoned after no progress within the lock timeout. Increase EMBEDDING_JOB_LOCK_TIMEOUT_MS for large OpenRouter reindexes.",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    },
  });
}

export async function assertEmbeddingJobCanRun(): Promise<void> {
  const config = await getAiRankingConfig();
  const status = getEmbeddingProviderStatus(config);

  if (config.embeddingsProvider !== "mock" && !status.ready) {
    throw new Error(
      `Embedding provider "${config.embeddingsProvider}" is not ready. Set OPENROUTER_API_KEY or EMBEDDINGS_API_KEY on search-api (and the embedding worker if separate), then restart.`,
    );
  }
}

async function abandonActiveCatalogEmbeddingJobs(reason: string): Promise<number> {
  const rows = await prismaClient.embeddingJob.findMany({
    where: {
      status: { in: ["queued", "running"] },
      jobType: { in: ["backfill", "reindex", "consistency_scan"] },
    },
    select: { id: true },
  });

  if (rows.length === 0) {
    return 0;
  }

  cancelEmbeddingJobs(rows.map((row: { id: string }) => row.id));

  await prismaClient.embeddingJob.updateMany({
    where: {
      id: { in: rows.map((row: { id: string }) => row.id) },
    },
    data: {
      status: "failed",
      errorMessage: reason,
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    },
  });

  if (getActiveInlineJobId() && rows.some((row: { id: string }) => row.id === getActiveInlineJobId())) {
    setActiveInlineJobId(null);
  }

  return rows.length;
}

export async function getEmbeddingCoverageSummary(
  totalProducts: number,
): Promise<EmbeddingCoverageDto> {
  const config = await getAiRankingConfig();
  const providerStatus = getEmbeddingProviderStatus(config);
  const coverage = await getEmbeddingCoverage(totalProducts);
  const jobs = await listEmbeddingJobs(1);
  return {
    ...coverage,
    model: config.embeddingsModel,
    provider: config.embeddingsProvider,
    effectiveProvider: providerStatus.effectiveProvider,
    providerReady: providerStatus.ready,
    lastJob: jobs[0],
  };
}

export { enqueueIncrementalEmbeddingJobs };

function resolveEmbeddingJobFailure(stats: {
  processedProducts: number;
  failedProducts: number;
  skippedProducts: number;
  lastError?: string;
}): string | null {
  if (stats.processedProducts > 0) {
    return null;
  }

  if (stats.failedProducts === 0 && stats.skippedProducts > 0) {
    return null;
  }

  if (stats.failedProducts > 0) {
    return stats.lastError ?? "All embedding batches failed";
  }

  return null;
}

async function resolveEmbeddingJobTargetCount(
  products: ProductDocument[],
  productIds?: string[],
): Promise<number> {
  if (productIds && productIds.length > 0) {
    return productIds.length;
  }
  if (isLargeCatalogMode()) {
    return countAllProductsInDatabase();
  }
  return products.length;
}

async function runEmbeddingJobInline(
  jobId: string,
  products: ProductDocument[],
  batchSize: number,
  productIds?: string[],
): Promise<void> {
  let processedTotal = 0;
  let failedTotal = 0;
  let skippedTotal = 0;
  let lastError: string | undefined;

  try {
    await assertEmbeddingJobCanRun();
    await markEmbeddingJobRunning(jobId);
    await touchEmbeddingJobLock(jobId);
    await hydrateVectorIndex();

    if (!(await shouldContinueEmbeddingJob(jobId))) {
      return;
    }

    if (isLargeCatalogMode()) {
      await forEachProductBatchFromDatabase(
        async (batch) => {
          if (!(await shouldContinueEmbeddingJob(jobId))) {
            return;
          }

          const result = await embedProductsBatch(batch, batchSize);
          processedTotal += batch.length;
          failedTotal += result.failed;
          skippedTotal += result.skipped;
          lastError = result.lastError ?? lastError;

          const stillRunning = await updateEmbeddingJobProgress(jobId, {
            processedProducts: processedTotal,
            failedProducts: failedTotal,
            skippedProducts: skippedTotal,
          });
          if (!stillRunning) {
            return;
          }
        },
        {
          batchSize: CATALOG_DB_BATCH_SIZE,
          productIds,
          allCatalogs: !productIds?.length,
        },
      );
    } else {
      const targetProducts =
        productIds && productIds.length > 0
          ? products.filter((product) => productIds.includes(product.id))
          : products;

      for (let index = 0; index < targetProducts.length; index += batchSize) {
        if (!(await shouldContinueEmbeddingJob(jobId))) {
          break;
        }

        const batch = targetProducts.slice(index, index + batchSize);
        const result = await embedProductsBatch(batch, batchSize);
        processedTotal += batch.length;
        failedTotal += result.failed;
        skippedTotal += result.skipped;
        lastError = result.lastError ?? lastError;

        const stillRunning = await updateEmbeddingJobProgress(jobId, {
          processedProducts: processedTotal,
          failedProducts: failedTotal,
          skippedProducts: skippedTotal,
        });
        if (!stillRunning) {
          break;
        }
      }
    }

    if (!(await shouldContinueEmbeddingJob(jobId))) {
      return;
    }

    const failureMessage = resolveEmbeddingJobFailure({
      processedProducts: processedTotal,
      failedProducts: failedTotal,
      skippedProducts: skippedTotal,
      lastError,
    });
    if (failureMessage) {
      throw new Error(failureMessage);
    }

    await completeEmbeddingJobInline(jobId, {
      processedProducts: processedTotal,
      failedProducts: failedTotal,
      skippedProducts: skippedTotal,
    });
  } catch (error) {
    if (await shouldContinueEmbeddingJob(jobId)) {
      await failEmbeddingJobInline(jobId, error instanceof Error ? error.message : "Embedding job failed", {
        processedProducts: processedTotal,
        failedProducts: failedTotal,
        skippedProducts: skippedTotal,
      });
    }
  } finally {
    clearEmbeddingJobCancellation(jobId);
    if (getActiveInlineJobId() === jobId) {
      setActiveInlineJobId(null);
    }
  }
}

export async function triggerEmbeddingJob(
  products: ProductDocument[],
  request: TriggerEmbeddingJobRequestDto = {},
): Promise<EmbeddingJobDto> {
  const isScopedJob = Boolean(request.productIds && request.productIds.length > 0);

  if (request.restart && !isScopedJob) {
    await abandonActiveCatalogEmbeddingJobs("Superseded by operator restart");
    setActiveInlineJobId(null);
  }

  if (!isScopedJob) {
    const active = await findActiveCatalogEmbeddingJob();
    if (active) {
      return active;
    }
  }

  const inlineJobId = getActiveInlineJobId();
  if (inlineJobId) {
    const inlineActive = await getEmbeddingJob(inlineJobId);
    if (
      inlineActive &&
      (inlineActive.status === "queued" || inlineActive.status === "running")
    ) {
      return inlineActive;
    }
    setActiveInlineJobId(null);
  }

  try {
    await assertEmbeddingJobCanRun();
  } catch (error) {
    throw error;
  }

  const config = await getAiRankingConfig();
  const workerConfig = getEmbeddingWorkerRuntimeConfig();
  const targetCount = await resolveEmbeddingJobTargetCount(products, request.productIds);

  const { id: jobId } = await enqueueEmbeddingJob(request, targetCount);

  if (workerConfig.enabled) {
    const job = await getEmbeddingJob(jobId);
    return job ?? toDto(await prismaClient.embeddingJob.findUnique({ where: { id: jobId } }));
  }

  setActiveInlineJobId(jobId);
  await markEmbeddingJobRunning(jobId);

  void runEmbeddingJobInline(jobId, products, config.embeddingBatchSize, request.productIds);

  const created = await getEmbeddingJob(jobId);
  return created ?? toDto(await prismaClient.embeddingJob.findUnique({ where: { id: jobId } }));
}
