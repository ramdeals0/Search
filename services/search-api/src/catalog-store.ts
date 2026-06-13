import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ProductAttributeMap,
  ProductDocument,
} from "@retailer-search/shared-types";
import { prisma } from "./db.js";

let cachedProducts: ProductDocument[] = [];
let catalogSource: "database" | "generated-json" | "empty" = "empty";
let catalogLoadPromise: Promise<number> | null = null;

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

function mapProductRow(row: {
  id: string;
  sku: string;
  title: string;
  description: string;
  price: number;
  inventory: number;
  inStock: boolean;
  imageUrl: string | null;
  attributes: unknown;
  createdAt: Date;
  updatedAt: Date;
  brand: { name: string };
  category: { department: string; subcategory: string };
}): ProductDocument {
  return {
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
    imageUrl: row.imageUrl ?? undefined,
    attributes: row.attributes as ProductAttributeMap,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function getProductCatalog(): ProductDocument[] {
  return cachedProducts;
}

export function getProductCatalogCount(): number {
  return cachedProducts.length;
}

export function getProductCatalogSource(): typeof catalogSource {
  return catalogSource;
}

export async function hydrateProductCatalog(): Promise<number> {
  try {
    const rows = await prisma.product.findMany({
      include: {
        brand: true,
        category: true,
      },
      orderBy: { id: "asc" },
    });

    cachedProducts = rows.map(mapProductRow);

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
    catalogSource = "generated-json";
    console.warn(
      `Product catalog database is empty or unavailable; loaded ${fallback.length} products from generated catalog.json. Run pnpm prisma:seed to persist catalog tables.`,
    );
    return cachedProducts.length;
  }

  cachedProducts = [];
  catalogSource = "empty";
  return 0;
}

export async function ensureProductCatalogLoaded(): Promise<number> {
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
