/** Catalog scale limits and thresholds for up to 80M products. */

export const MAX_CATALOG_PRODUCTS = 80_000_000;

export const DEFAULT_TARGET_PRODUCT_COUNT = 30_000;

const DEFAULT_IN_MEMORY_THRESHOLD = isRailwayRuntime() ? 25_000 : 100_000;

export const CATALOG_IN_MEMORY_THRESHOLD = readIntEnv(
  "CATALOG_IN_MEMORY_THRESHOLD",
  DEFAULT_IN_MEMORY_THRESHOLD,
);

export const EMBEDDING_IN_MEMORY_THRESHOLD = readIntEnv(
  "EMBEDDING_IN_MEMORY_THRESHOLD",
  isRailwayRuntime() ? 1_000 : 5_000,
);

const DEFAULT_SEARCH_CANDIDATE_LIMIT = isRailwayRuntime() ? 1_500 : 5_000;

export const CATALOG_SEARCH_CANDIDATE_LIMIT = readIntEnv(
  "CATALOG_SEARCH_CANDIDATE_LIMIT",
  DEFAULT_SEARCH_CANDIDATE_LIMIT,
);

export const CATALOG_DB_BATCH_SIZE = readIntEnv("CATALOG_DB_BATCH_SIZE", 1_000);

export const CATALOG_VECTOR_SEARCH_LIMIT = readIntEnv(
  "CATALOG_VECTOR_SEARCH_LIMIT",
  500,
);

export const CATALOG_BROWSE_MAX_PAGE_SIZE = 100;

export const CATALOG_SEED_BATCH_SIZE = readIntEnv("CATALOG_SEED_BATCH_SIZE", 2_000);

export type CatalogScaleMode = "in_memory" | "database";

function isRailwayRuntime(): boolean {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_SERVICE_ID ||
      process.env.RAILWAY_PROJECT_ID,
  );
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readTargetProductCount(): number {
  const raw = process.env.TARGET_PRODUCT_COUNT ?? process.env.SEED_PRODUCT_COUNT;
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_TARGET_PRODUCT_COUNT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_TARGET_PRODUCT_COUNT;
  }
  return Math.min(parsed, MAX_CATALOG_PRODUCTS);
}

export function shouldUseDatabaseCatalogMode(productCount: number): boolean {
  return productCount > CATALOG_IN_MEMORY_THRESHOLD;
}
