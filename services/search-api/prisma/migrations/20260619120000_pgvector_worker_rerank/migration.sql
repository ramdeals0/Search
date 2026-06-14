-- pgvector worker + unified rerank: embedding metadata, job queue fields, ANN index options.
-- Default ANN index: HNSW (already present on Railway; good recall/latency for moderate catalogs).
-- IVFFlat alternative: set VECTOR_INDEX_TYPE=ivfflat and run rebuild script after backfill.

-- Embedding metadata for observability and content-hash dedupe (textHash = content_hash).
ALTER TABLE "ProductEmbedding"
ADD COLUMN IF NOT EXISTS "sourceText" TEXT,
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "lastIndexedAt" TIMESTAMP(3);

UPDATE "ProductEmbedding"
SET "createdAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "createdAt" IS NULL;

-- Job queue fields for Railway worker (claim, retry, dead-letter).
ALTER TABLE "EmbeddingJob"
ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "maxRetries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lockedBy" TEXT,
ADD COLUMN IF NOT EXISTS "nextRunAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "productIds" JSONB,
ADD COLUMN IF NOT EXISTS "skippedProducts" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "EmbeddingJob_status_nextRunAt_idx"
ON "EmbeddingJob" ("status", "nextRunAt", "createdAt");

-- Ensure pgvector extension (idempotent).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension unavailable';
END $$;

-- embeddingVector column from prior migration; ensure dimensions match EMBEDDING_DIMENSIONS (default 64).
ALTER TABLE "ProductEmbedding"
ADD COLUMN IF NOT EXISTS "embeddingVector" vector(64);

-- HNSW index (default): no training step, works on empty/small tables, strong recall on Railway.
-- Operational note: rebuild with CONCURRENTLY during low traffic if tuning m/ef_construction.
CREATE INDEX IF NOT EXISTS "ProductEmbedding_vector_hnsw_idx"
ON "ProductEmbedding"
USING hnsw ("embeddingVector" vector_cosine_ops)
WHERE "embeddingVector" IS NOT NULL;

-- IVFFlat index (optional): create only when VECTOR_INDEX_TYPE=ivfflat at deploy time.
-- IVFFlat requires sufficient rows before build; use scripts/rebuild-vector-index.mjs after backfill.
-- lists=100 is a sensible starting point for ~10k–100k vectors; tune probes at query time (VECTOR_QUERY_PROBES).
DO $$
BEGIN
  IF current_setting('app.vector_index_type', true) = 'ivfflat' THEN
    DROP INDEX IF EXISTS "ProductEmbedding_vector_hnsw_idx";
    CREATE INDEX IF NOT EXISTS "ProductEmbedding_vector_ivfflat_idx"
    ON "ProductEmbedding"
    USING ivfflat ("embeddingVector" vector_cosine_ops)
    WITH (lists = 100)
    WHERE "embeddingVector" IS NOT NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'IVFFlat index skipped (set app.vector_index_type=ivfflat session var during migrate to enable)';
END $$;
