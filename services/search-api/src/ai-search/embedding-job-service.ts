import type {
  EmbeddingCoverageDto,
  EmbeddingJobDto,
  EmbeddingsProviderName,
  TriggerEmbeddingJobRequestDto,
} from "@retailer-search/shared-types";
import type { ProductDocument } from "@retailer-search/shared-types";
import { prisma } from "../db.js";
import { forEachProductBatchFromDatabase } from "../catalog/catalog-db-queries.js";
import { CATALOG_DB_BATCH_SIZE } from "../catalog/catalog-scale-config.js";
import { isLargeCatalogMode } from "../catalog-store.js";
import { getAiRankingConfig } from "./ai-ranking-config-store.js";
import {
  enqueueEmbeddingJob,
  enqueueIncrementalEmbeddingJobs,
} from "./embedding-job-queue.js";
import { embedProductsBatch, getEmbeddingCoverage, hydrateVectorIndex } from "./vector-index.js";
import { getEmbeddingWorkerRuntimeConfig } from "./vector-config.js";

const prismaClient = prisma as any;

let activeJobId: string | null = null;

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

export async function getEmbeddingCoverageSummary(
  totalProducts: number,
): Promise<EmbeddingCoverageDto> {
  const config = await getAiRankingConfig();
  const coverage = await getEmbeddingCoverage(totalProducts);
  const jobs = await listEmbeddingJobs(1);
  return {
    ...coverage,
    model: config.embeddingsModel,
    provider: config.embeddingsProvider,
    lastJob: jobs[0],
  };
}

export { enqueueIncrementalEmbeddingJobs };

async function runEmbeddingJobInline(
  jobId: string,
  products: ProductDocument[],
  batchSize: number,
  productIds?: string[],
): Promise<void> {
  let processedTotal = 0;
  let failedTotal = 0;
  let skippedTotal = 0;

  try {
    await prismaClient.embeddingJob.update({
      where: { id: jobId },
      data: { status: "running", startedAt: new Date() },
    });
    await hydrateVectorIndex();

    if (isLargeCatalogMode()) {
      await forEachProductBatchFromDatabase(
        async (batch) => {
          const result = await embedProductsBatch(batch, batchSize);
          processedTotal += result.processed + result.skipped;
          failedTotal += result.failed;
          skippedTotal += result.skipped;
          await prismaClient.embeddingJob.update({
            where: { id: jobId },
            data: {
              processedProducts: processedTotal,
              failedProducts: failedTotal,
              skippedProducts: skippedTotal,
            },
          });
        },
        {
          batchSize: CATALOG_DB_BATCH_SIZE,
          productIds,
        },
      );
    } else {
      const targetProducts =
        productIds && productIds.length > 0
          ? products.filter((product) => productIds.includes(product.id))
          : products;

      for (let index = 0; index < targetProducts.length; index += batchSize) {
        const batch = targetProducts.slice(index, index + batchSize);
        const result = await embedProductsBatch(batch, batchSize);
        processedTotal += result.processed + result.skipped;
        failedTotal += result.failed;
        skippedTotal += result.skipped;
        await prismaClient.embeddingJob.update({
          where: { id: jobId },
          data: {
            processedProducts: processedTotal,
            failedProducts: failedTotal,
            skippedProducts: skippedTotal,
          },
        });
      }
    }

    await prismaClient.embeddingJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        processedProducts: processedTotal,
        failedProducts: failedTotal,
        skippedProducts: skippedTotal,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    await prismaClient.embeddingJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Embedding job failed",
        processedProducts: processedTotal,
        failedProducts: failedTotal,
        skippedProducts: skippedTotal,
        completedAt: new Date(),
      },
    });
  } finally {
    if (activeJobId === jobId) {
      activeJobId = null;
    }
  }
}

export async function triggerEmbeddingJob(
  products: ProductDocument[],
  request: TriggerEmbeddingJobRequestDto = {},
): Promise<EmbeddingJobDto> {
  if (activeJobId) {
    const active = await getEmbeddingJob(activeJobId);
    if (active && (active.status === "queued" || active.status === "running")) {
      return active;
    }
  }

  const config = await getAiRankingConfig();
  const workerConfig = getEmbeddingWorkerRuntimeConfig();
  const useDatabaseCatalog = isLargeCatalogMode();
  const targetCount =
    request.productIds && request.productIds.length > 0
      ? request.productIds.length
      : useDatabaseCatalog
        ? await prisma.product.count()
        : products.length;

  const { id: jobId } = await enqueueEmbeddingJob(request, targetCount);

  if (workerConfig.enabled) {
    const job = await getEmbeddingJob(jobId);
    return job ?? toDto(await prismaClient.embeddingJob.findUnique({ where: { id: jobId } }));
  }

  activeJobId = jobId;
  void runEmbeddingJobInline(jobId, products, config.embeddingBatchSize, request.productIds);
  const created = await getEmbeddingJob(jobId);
  return created ?? toDto(await prismaClient.embeddingJob.findUnique({ where: { id: jobId } }));
}
