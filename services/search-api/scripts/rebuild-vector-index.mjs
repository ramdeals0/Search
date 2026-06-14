#!/usr/bin/env node
/**
 * Rebuild pgvector ANN index after large backfill or when switching IVFFlat/HNSW.
 * Usage:
 *   VECTOR_INDEX_TYPE=ivfflat VECTOR_INDEX_LISTS=200 node scripts/rebuild-vector-index.mjs
 */
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const indexType = (process.env.VECTOR_INDEX_TYPE ?? "hnsw").toLowerCase();
const lists = Number.parseInt(process.env.VECTOR_INDEX_LISTS ?? "100", 10);
const dimensions = Number.parseInt(process.env.EMBEDDING_DIMENSIONS ?? "64", 10);

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
});

await client.connect();

console.log(`Rebuilding vector ANN index type=${indexType} dimensions=${dimensions}`);

await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);

await client.query(`DROP INDEX IF EXISTS "ProductEmbedding_vector_hnsw_idx"`);
await client.query(`DROP INDEX IF EXISTS "ProductEmbedding_vector_ivfflat_idx"`);

if (indexType === "ivfflat") {
  // IVFFlat: run only after table has enough rows for stable centroids.
  const countResult = await client.query(
    `SELECT COUNT(*)::int AS count FROM "ProductEmbedding" WHERE "embeddingVector" IS NOT NULL`,
  );
  const count = countResult.rows[0]?.count ?? 0;
  if (count < lists) {
    console.warn(
      `Warning: only ${count} vectors; IVFFlat lists=${lists} may underperform. Consider lowering VECTOR_INDEX_LISTS.`,
    );
  }
  await client.query(`
    CREATE INDEX "ProductEmbedding_vector_ivfflat_idx"
    ON "ProductEmbedding"
    USING ivfflat ("embeddingVector" vector_cosine_ops)
    WITH (lists = ${lists})
    WHERE "embeddingVector" IS NOT NULL
  `);
  console.log(`Created IVFFlat index lists=${lists}. Tune recall with SET ivfflat.probes at query time.`);
} else {
  await client.query(`
    CREATE INDEX "ProductEmbedding_vector_hnsw_idx"
    ON "ProductEmbedding"
    USING hnsw ("embeddingVector" vector_cosine_ops)
    WHERE "embeddingVector" IS NOT NULL
  `);
  console.log("Created HNSW index. Tune recall with SET hnsw.ef_search (VECTOR_QUERY_EF_SEARCH).");
}

await client.end();
console.log("Vector index rebuild complete.");
