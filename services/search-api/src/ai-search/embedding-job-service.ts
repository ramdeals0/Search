import type {
  EmbeddingCoverageDto,
  EmbeddingJobDto,
  EmbeddingsProviderName,
  TriggerEmbeddingJobRequestDto,
} from "@retailer-search/shared-types";
import type { ProductDocument } from "@retailer-search/shared-types";
import { prisma } from "../db.js";
const prismaClient = prisma as any;
import { getAiRankingConfig } from "./ai-ranking-config-store.js";
import { embedProductsBatch, getEmbeddingCoverage, hydrateVectorIndex } from "./vector-index.js";

let activeJobId: string | null = null;

function toDto(row: {
  id: string;
  status: string;
  jobType: string;
  totalProducts: number;
  processedProducts: number;
  failedProducts: number;
  model: string;
  provider: string;
  errorMessage: string | null;
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
    model: row.model,
    provider: row.provider as EmbeddingsProviderName,
    errorMessage: row.errorMessage ?? undefined,
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
  const targetProducts =
    request.productIds && request.productIds.length > 0
      ? products.filter((product) => request.productIds!.includes(product.id))
      : products;

  const row = await prismaClient.embeddingJob.create({
    data: {
      status: "queued",
      jobType: request.jobType ?? "backfill",
      totalProducts: targetProducts.length,
      model: config.embeddingsModel,
      provider: config.embeddingsProvider,
    },
  });

  activeJobId = row.id;
  void runEmbeddingJob(row.id, targetProducts, config.embeddingBatchSize);
  return toDto(row);
}

async function runEmbeddingJob(
  jobId: string,
  products: ProductDocument[],
  batchSize: number,
): Promise<void> {
  try {
    await prismaClient.embeddingJob.update({
      where: { id: jobId },
      data: { status: "running", startedAt: new Date() },
    });
    await hydrateVectorIndex();
    const result = await embedProductsBatch(products, batchSize);
    await prismaClient.embeddingJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        processedProducts: result.processed,
        failedProducts: result.failed,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    await prismaClient.embeddingJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Embedding job failed",
        completedAt: new Date(),
      },
    });
  } finally {
    if (activeJobId === jobId) {
      activeJobId = null;
    }
  }
}
