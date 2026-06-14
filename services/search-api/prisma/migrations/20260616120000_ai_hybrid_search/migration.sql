-- AI-first hybrid search: embedding metadata, jobs, experiment AI config

ALTER TABLE "ProductEmbedding"
  ADD COLUMN IF NOT EXISTS "textHash" TEXT,
  ADD COLUMN IF NOT EXISTS "model" TEXT NOT NULL DEFAULT 'mock-hash-v1',
  ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'mock',
  ADD COLUMN IF NOT EXISTS "dimensions" INTEGER NOT NULL DEFAULT 64;

ALTER TABLE "ExperimentRecord"
  ADD COLUMN IF NOT EXISTS "candidateAiConfig" JSONB;

CREATE TABLE IF NOT EXISTS "EmbeddingJob" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "jobType" TEXT NOT NULL DEFAULT 'backfill',
    "totalProducts" INTEGER NOT NULL DEFAULT 0,
    "processedProducts" INTEGER NOT NULL DEFAULT 0,
    "failedProducts" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL DEFAULT 'mock-hash-v1',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmbeddingJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmbeddingJob_status_createdAt_idx"
  ON "EmbeddingJob"("status", "createdAt");
