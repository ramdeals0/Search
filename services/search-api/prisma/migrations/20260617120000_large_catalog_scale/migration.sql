-- Large catalog scale: PostgreSQL FTS + optional pgvector for semantic ANN.
-- Supports query-time retrieval without loading full catalog into API memory.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Expression GIN index for full-text search on product title + description.
CREATE INDEX IF NOT EXISTS "Product_fts_title_description_idx"
ON "Product"
USING gin (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", '')));

-- Trigram index for autocomplete prefix matching on titles.
CREATE INDEX IF NOT EXISTS "Product_title_trgm_idx"
ON "Product"
USING gin ("title" gin_trgm_ops);

-- Composite indexes for browse filter + sort paths at scale.
CREATE INDEX IF NOT EXISTS "Product_catalogId_inStock_price_idx"
ON "Product" ("catalogId", "inStock", "price");

CREATE INDEX IF NOT EXISTS "Product_catalogId_categoryId_idx"
ON "Product" ("catalogId", "categoryId");

-- Optional pgvector for embedding ANN (Railway Postgres supports pgvector).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension unavailable; semantic search falls back to candidate-scoped retrieval';
END $$;

ALTER TABLE "ProductEmbedding"
ADD COLUMN IF NOT EXISTS "embeddingVector" vector(64);

CREATE INDEX IF NOT EXISTS "ProductEmbedding_vector_hnsw_idx"
ON "ProductEmbedding"
USING hnsw ("embeddingVector" vector_cosine_ops)
WHERE "embeddingVector" IS NOT NULL;
