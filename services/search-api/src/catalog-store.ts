import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProductDocument } from "@retailer-search/shared-types";
import { prisma } from "./db.js";
import {
  countAllProductsInDatabase,
  fetchProductById,
  mapProductRow,
  type ProductRowWithRelations,
} from "./catalog/catalog-db-queries.js";
import {
  CATALOG_IN_MEMORY_THRESHOLD,
  MAX_CATALOG_PRODUCTS,
  shouldUseDatabaseCatalogMode,
  type CatalogScaleMode,
} from "./catalog/catalog-scale-config.js";

let cachedProducts: ProductDocument[] = [];
let catalogSource: "database" | "generated-json" | "empty" = "empty";
let catalogLoadPromise: Promise<number> | null = null;
let catalogScaleMode: CatalogScaleMode = "in_memory";
let databaseProductCount = 0;

const GENERATED_CATALOG_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../prisma/seed-data/generated/catalog.json",
);

function loadGeneratedCatalogFallback(): ProductDocument[] {
  try {
    const payload = JSON.parse(readFileSync(GENERATED_CATALOG_PATH, "utf8")) as {
      products?: ProductDocument[];
    };
    return payload.products ?? [];
  } catch {
    return [];
  }
}

export function isLargeCatalogMode(): boolean {
  return catalogScaleMode === "database";
}

export function getCatalogScaleMode(): CatalogScaleMode {
  return catalogScaleMode;
}

export function getMaxCatalogProducts(): number {
  return MAX_CATALOG_PRODUCTS;
}

export function getProductCatalog(): ProductDocument[] {
  return cachedProducts;
}

export function filterProductCatalogByCatalogId(
  products: ProductDocument[],
  catalogId: string,
): ProductDocument[] {
  if (isLargeCatalogMode()) {
    return products;
  }
  if (!catalogId || catalogId === "default") {
    return products.filter(
      (product) => !product.catalogId || product.catalogId === "default",
    );
  }
  return products.filter((product) => product.catalogId === catalogId);
}

export function getProductCatalogCount(): number {
  if (isLargeCatalogMode()) {
    return databaseProductCount;
  }
  return cachedProducts.length;
}

export function getProductCatalogSource(): typeof catalogSource {
  return catalogSource;
}

export async function getProductById(productId: string): Promise<ProductDocument | null> {
  if (isLargeCatalogMode()) {
    return fetchProductById(productId);
  }
  await ensureProductCatalogLoaded();
  return cachedProducts.find((product) => product.id === productId) ?? null;
}

export async function hydrateProductCatalog(): Promise<number> {
  try {
    databaseProductCount = await countAllProductsInDatabase();

    if (databaseProductCount > MAX_CATALOG_PRODUCTS) {
      throw new Error(
        `Catalog has ${databaseProductCount} products; maximum supported is ${MAX_CATALOG_PRODUCTS}.`,
      );
    }

    if (shouldUseDatabaseCatalogMode(databaseProductCount)) {
      catalogScaleMode = "database";
      cachedProducts = [];
      catalogSource = "database";
      console.log(
        `Catalog scale mode: database (${databaseProductCount.toLocaleString()} products; in-memory threshold ${CATALOG_IN_MEMORY_THRESHOLD.toLocaleString()}).`,
      );
      return databaseProductCount;
    }

    const rows = await prisma.product.findMany({
      include: {
        brand: true,
        category: true,
      },
      orderBy: { id: "asc" },
    });

    cachedProducts = rows.map((row) => mapProductRow(row as ProductRowWithRelations));
    catalogScaleMode = "in_memory";

    if (cachedProducts.length > 0) {
      catalogSource = "database";
      return cachedProducts.length;
    }
  } catch (error) {
    console.warn(
      "Failed to load product catalog from database; trying generated fallback.",
      error,
    );
  }

  const fallback = loadGeneratedCatalogFallback();
  if (fallback.length > 0) {
    cachedProducts = fallback;
    catalogScaleMode = "in_memory";
    catalogSource = "generated-json";
    databaseProductCount = fallback.length;
    console.warn(
      `Product catalog database is empty or unavailable; loaded ${fallback.length} products from generated catalog.json. Run pnpm prisma:seed to persist catalog tables.`,
    );
    return cachedProducts.length;
  }

  cachedProducts = [];
  catalogScaleMode = "in_memory";
  catalogSource = "empty";
  databaseProductCount = 0;
  return 0;
}

export async function ensureProductCatalogLoaded(): Promise<number> {
  if (isLargeCatalogMode()) {
    return databaseProductCount;
  }
  if (cachedProducts.length > 0) {
    return cachedProducts.length;
  }

  if (!catalogLoadPromise) {
    catalogLoadPromise = hydrateProductCatalog().finally(() => {
      catalogLoadPromise = null;
    });
  }

  return catalogLoadPromise;
}

export async function reloadProductCatalog(): Promise<ProductDocument[]> {
  await hydrateProductCatalog();
  return cachedProducts;
}
