/**
 * Railway-compatible embedding worker entrypoint.
 * Deploy as a separate Railway service with startCommand:
 *   pnpm --filter @retailer-search/search-api start:worker
 */
import { prisma } from "./db.js";
import { forEachProductBatchFromDatabase } from "./catalog/catalog-db-queries.js";
import { CATALOG_DB_BATCH_SIZE } from "./catalog/catalog-scale-config.js";
import { isLargeCatalogMode } from "./catalog-store.js";
import { getAiRankingConfig } from "./ai-search/ai-ranking-config-store.js";
import { assertEmbeddingJobCanRun } from "./ai-search/embedding-job-service.js";
import {
  shouldContinueEmbeddingJob,
  updateEmbeddingJobProgress,
} from "./ai-search/embedding-job-runtime.js";
import {
  claimNextEmbeddingJob,
  completeEmbeddingJob,
  failEmbeddingJob,
} from "./ai-search/embedding-job-queue.js";
import { embedProductsBatch, hydrateVectorIndex } from "./ai-search/vector-index.js";
import { getEmbeddingWorkerRuntimeConfig } from "./ai-search/vector-config.js";

const prismaClient = prisma as any;

let shuttingDown = false;

process.on("SIGTERM", () => {
  shuttingDown = true;
  console.log("Embedding worker received SIGTERM; finishing current job...");
});
process.on("SIGINT", () => {
  shuttingDown = true;
  console.log("Embedding worker received SIGINT; finishing current job...");
});

async function processClaimedJob(
  job: Awaited<ReturnType<typeof claimNextEmbeddingJob>>,
): Promise<void> {
  if (!job) {
    return;
  }

  const workerConfig = getEmbeddingWorkerRuntimeConfig();
  let processedTotal = 0;
  let failedTotal = 0;
  let skippedTotal = 0;
  let lastError: string | undefined;

  console.log(
    `[embedding-worker] job=${job.id} type=${job.jobType} retry=${job.retryCount}/${job.maxRetries}`,
  );

  try {
    await assertEmbeddingJobCanRun();
    await hydrateVectorIndex();

    if (isLargeCatalogMode() || job.productIds?.length) {
      await forEachProductBatchFromDatabase(
        async (batch) => {
          if (!(await shouldContinueEmbeddingJob(job.id))) {
            return;
          }

          const result = await embedProductsBatch(batch, workerConfig.batchSize);
          processedTotal += batch.length;
          failedTotal += result.failed;
          skippedTotal += result.skipped;
          lastError = result.lastError ?? lastError;

          const stillRunning = await updateEmbeddingJobProgress(job.id, {
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
          productIds: job.productIds,
          allCatalogs: !job.productIds?.length,
        },
      );
    } else {
      const rows = await prismaClient.product.findMany({
        include: { brand: true, category: true },
        ...(job.productIds?.length ? { where: { id: { in: job.productIds } } } : {}),
      });
      const products = rows.map((row: any) => ({
        id: row.id,
        sku: row.sku,
        title: row.title,
        brand: row.brand.name,
        category: row.category.department,
        subcategory: row.category.subcategory,
        description: row.description,
        price: row.price,
        inventory: row.inventory,
        inStock: row.inStock,
        attributes: row.attributes ?? {},
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
      const result = await embedProductsBatch(products, workerConfig.batchSize);
      processedTotal = products.length;
      failedTotal = result.failed;
      skippedTotal = result.skipped;
      lastError = result.lastError;
    }

    if (processedTotal === 0 && failedTotal > 0) {
      throw new Error(lastError ?? "All embedding batches failed");
    }

    if (failedTotal > 0 && processedTotal > 0) {
      console.warn(
        `[embedding-worker] job=${job.id} completed with ${failedTotal.toLocaleString()} failed products`,
      );
    }

    await completeEmbeddingJob(job.id, {
      processedProducts: processedTotal,
      failedProducts: failedTotal,
      skippedProducts: skippedTotal,
    });
    console.log(
      `[embedding-worker] completed job=${job.id} processed=${processedTotal} skipped=${skippedTotal} failed=${failedTotal}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Embedding job failed";
    await failEmbeddingJob(job.id, message, {
      processedProducts: processedTotal,
      failedProducts: failedTotal,
      skippedProducts: skippedTotal,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
    });
    console.error(`[embedding-worker] failed job=${job.id}: ${message}`);
  }
}

async function runBackfillSweepIfEnabled(): Promise<void> {
  const workerConfig = getEmbeddingWorkerRuntimeConfig();
  if (!workerConfig.backfillCronEnabled) {
    return;
  }

  const pending = await prismaClient.embeddingJob.count({
    where: { status: { in: ["queued", "running"] } },
  });
  if (pending > 0) {
    return;
  }

  const totalProducts = await prisma.product.count();
  const embedded = await prismaClient.productEmbedding.count();
  if (embedded >= totalProducts) {
    return;
  }

  const config = await getAiRankingConfig();
  await prismaClient.embeddingJob.create({
    data: {
      status: "queued",
      jobType: "backfill",
      totalProducts,
      model: config.embeddingsModel,
      provider: config.embeddingsProvider,
      maxRetries: workerConfig.maxRetries,
    },
  });
  console.log("[embedding-worker] scheduled consistency backfill sweep");
}

async function workerLoop(): Promise<void> {
  const workerConfig = getEmbeddingWorkerRuntimeConfig();
  console.log(
    `[embedding-worker] started id=${workerConfig.workerId} pollMs=${workerConfig.pollMs}`,
  );

  while (!shuttingDown) {
    await runBackfillSweepIfEnabled();

    const job = await claimNextEmbeddingJob(workerConfig.workerId, workerConfig.lockTimeoutMs);
    if (job) {
      await processClaimedJob(job);
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, workerConfig.pollMs));
  }
}

async function main(): Promise<void> {
  const workerConfig = getEmbeddingWorkerRuntimeConfig();
  if (!workerConfig.enabled && process.env.NODE_ENV !== "test") {
    console.error(
      "EMBEDDING_WORKER_ENABLED is not true. Set it to run the dedicated worker service.",
    );
    process.exit(1);
  }

  await workerLoop();
  await prisma.$disconnect();
  console.log("[embedding-worker] shutdown complete");
}

main().catch(async (error) => {
  console.error("[embedding-worker] fatal error:", error);
  await prisma.$disconnect();
  process.exit(1);
});
