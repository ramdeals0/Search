import { prisma } from "../db.js";

const prismaClient = prisma as any;

const cancelledJobIds = new Set<string>();
let activeInlineJobId: string | null = null;

export function getActiveInlineJobId(): string | null {
  return activeInlineJobId;
}

export function setActiveInlineJobId(jobId: string | null): void {
  activeInlineJobId = jobId;
}

export function cancelEmbeddingJobs(jobIds: string[]): void {
  for (const jobId of jobIds) {
    cancelledJobIds.add(jobId);
  }
}

export function clearEmbeddingJobCancellation(jobId: string): void {
  cancelledJobIds.delete(jobId);
}

export async function shouldContinueEmbeddingJob(jobId: string): Promise<boolean> {
  if (cancelledJobIds.has(jobId)) {
    return false;
  }

  const row = await prismaClient.embeddingJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });

  return row?.status === "running";
}

export async function markEmbeddingJobRunning(jobId: string): Promise<void> {
  await prismaClient.embeddingJob.update({
    where: { id: jobId },
    data: {
      status: "running",
      startedAt: new Date(),
      lockedAt: new Date(),
      errorMessage: null,
      completedAt: null,
    },
  });
}

export async function touchEmbeddingJobLock(jobId: string): Promise<boolean> {
  const result = await prismaClient.embeddingJob.updateMany({
    where: { id: jobId, status: "running" },
    data: { lockedAt: new Date() },
  });
  return result.count > 0;
}

export async function updateEmbeddingJobProgress(
  jobId: string,
  stats: {
    processedProducts: number;
    failedProducts: number;
    skippedProducts: number;
  },
): Promise<boolean> {
  if (!(await shouldContinueEmbeddingJob(jobId))) {
    return false;
  }

  const result = await prismaClient.embeddingJob.updateMany({
    where: { id: jobId, status: "running" },
    data: {
      processedProducts: stats.processedProducts,
      failedProducts: stats.failedProducts,
      skippedProducts: stats.skippedProducts,
      lockedAt: new Date(),
    },
  });

  return result.count > 0;
}

export async function completeEmbeddingJobInline(
  jobId: string,
  stats: {
    processedProducts: number;
    failedProducts: number;
    skippedProducts: number;
  },
): Promise<boolean> {
  if (!(await shouldContinueEmbeddingJob(jobId))) {
    return false;
  }

  const result = await prismaClient.embeddingJob.updateMany({
    where: { id: jobId, status: "running" },
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

  return result.count > 0;
}

export async function failEmbeddingJobInline(
  jobId: string,
  errorMessage: string,
  stats: {
    processedProducts: number;
    failedProducts: number;
    skippedProducts: number;
  },
): Promise<boolean> {
  if (cancelledJobIds.has(jobId)) {
    return false;
  }

  const result = await prismaClient.embeddingJob.updateMany({
    where: { id: jobId, status: { in: ["queued", "running"] } },
    data: {
      status: "failed",
      errorMessage,
      processedProducts: stats.processedProducts,
      failedProducts: stats.failedProducts,
      skippedProducts: stats.skippedProducts,
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    },
  });

  return result.count > 0;
}
