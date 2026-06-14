/**
 * pgvector and hybrid search runtime configuration from environment variables.
 * Operational tuning: see PGVECTOR_WORKER_RERANK_IMPLEMENTATION.md at repo root.
 */

export type VectorDistanceMetric = "cosine" | "inner_product" | "l2";
export type VectorIndexType = "hnsw" | "ivfflat" | "none";

function envBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  return value === "true" || value === "1";
}

function envNumber(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envString<T extends string>(
  name: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = process.env[name]?.trim().toLowerCase();
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

export interface VectorSearchRuntimeConfig {
  pgvectorEnabled: boolean;
  distanceMetric: VectorDistanceMetric;
  indexType: VectorIndexType;
  indexLists: number;
  queryProbes: number;
  queryEfSearch: number;
  dimensions: number;
}

export interface EmbeddingWorkerRuntimeConfig {
  enabled: boolean;
  pollMs: number;
  backfillCronEnabled: boolean;
  concurrency: number;
  batchSize: number;
  maxRetries: number;
  lockTimeoutMs: number;
  workerId: string;
}

export interface RerankRuntimeConfig {
  enabled: boolean;
  provider: "off" | "score_fusion" | "cross_encoder" | "llm";
  topN: number;
  timeoutMs: number;
}

export function getVectorSearchRuntimeConfig(): VectorSearchRuntimeConfig {
  return {
    pgvectorEnabled: envBool("PGVECTOR_ENABLED", true),
    distanceMetric: envString(
      "VECTOR_DISTANCE_METRIC",
      ["cosine", "inner_product", "l2"] as const,
      "cosine",
    ),
    indexType: envString(
      "VECTOR_INDEX_TYPE",
      ["hnsw", "ivfflat", "none"] as const,
      "hnsw",
    ),
    indexLists: envNumber("VECTOR_INDEX_LISTS", 100),
    queryProbes: envNumber("VECTOR_QUERY_PROBES", 10),
    queryEfSearch: envNumber("VECTOR_QUERY_EF_SEARCH", 40),
    dimensions: envNumber("EMBEDDING_DIMENSIONS", 64),
  };
}

export function getEmbeddingWorkerRuntimeConfig(): EmbeddingWorkerRuntimeConfig {
  const hostname = process.env.HOSTNAME ?? process.env.RAILWAY_REPLICA_ID ?? "local";
  return {
    enabled: envBool("EMBEDDING_WORKER_ENABLED", false),
    pollMs: envNumber("EMBEDDING_WORKER_POLL_MS", 2000),
    backfillCronEnabled: envBool("EMBEDDING_BACKFILL_CRON_ENABLED", false),
    concurrency: envNumber("EMBEDDINGS_CONCURRENCY", 1),
    batchSize: envNumber("EMBEDDINGS_BATCH_SIZE", envNumber("EMBEDDING_BATCH_SIZE", 32)),
    maxRetries: envNumber("EMBEDDINGS_MAX_RETRIES", 3),
    lockTimeoutMs: envNumber("EMBEDDING_JOB_LOCK_TIMEOUT_MS", 300_000),
    workerId: process.env.EMBEDDING_WORKER_ID ?? `worker-${hostname}-${process.pid}`,
  };
}

export function getRerankRuntimeConfig(): RerankRuntimeConfig {
  const providerRaw = process.env.RERANK_PROVIDER?.trim().toLowerCase();
  const rerankEnabled = envBool("RERANK_ENABLED", false);
  let provider: RerankRuntimeConfig["provider"] = "score_fusion";
  if (!rerankEnabled || providerRaw === "off") {
    provider = "off";
  } else if (
    providerRaw === "cross_encoder" ||
    providerRaw === "llm" ||
    providerRaw === "score_fusion"
  ) {
    provider = providerRaw;
  }
  return {
    enabled: rerankEnabled && provider !== "off",
    provider,
    topN: envNumber("RERANK_TOP_N", 50),
    timeoutMs: envNumber("RERANK_TIMEOUT_MS", 500),
  };
}

/** Distance SQL operator for pgvector (<=> cosine, <#> inner product, <-> L2). */
export function vectorDistanceOperator(metric: VectorDistanceMetric): string {
  switch (metric) {
    case "inner_product":
      return "<#>";
    case "l2":
      return "<->";
    case "cosine":
    default:
      return "<=>";
  }
}

/** Score expression from distance (higher = better). Cosine: 1 - distance. */
export function vectorScoreSql(distanceOp: string): string {
  if (distanceOp === "<=>") {
    return `(1 - (pe."embeddingVector" ${distanceOp} $1::vector))`;
  }
  if (distanceOp === "<#>") {
    return `(-(pe."embeddingVector" ${distanceOp} $1::vector))`;
  }
  return `(1 / (1 + (pe."embeddingVector" ${distanceOp} $1::vector)))`;
}
