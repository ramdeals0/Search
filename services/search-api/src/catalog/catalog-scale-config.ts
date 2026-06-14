/** Catalog scale limits and thresholds for up to 80M products. */

export const MAX_CATALOG_PRODUCTS = 80_000_000;

export const CATALOG_IN_MEMORY_THRESHOLD = readIntEnv(
  "CATALOG_IN_MEMORY_THRESHOLD",
  100_000,
);

export const CATALOG_SEARCH_CANDIDATE_LIMIT = readIntEnv(
  "CATALOG_SEARCH_CANDIDATE_LIMIT",
  5_000,
);

export const CATALOG_DB_BATCH_SIZE = readIntEnv("CATALOG_DB_BATCH_SIZE", 1_000);

export const CATALOG_VECTOR_SEARCH_LIMIT = readIntEnv(
  "CATALOG_VECTOR_SEARCH_LIMIT",
  500,
);

export const CATALOG_BROWSE_MAX_PAGE_SIZE = 100;

export const CATALOG_SEED_BATCH_SIZE = readIntEnv("CATALOG_SEED_BATCH_SIZE", 2_000);

export type CatalogScaleMode = "in_memory" | "database";

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
    return 50_000;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 50_000;
  }
  return Math.min(parsed, MAX_CATALOG_PRODUCTS);
}

export function shouldUseDatabaseCatalogMode(productCount: number): boolean {
  return productCount > CATALOG_IN_MEMORY_THRESHOLD;
}
