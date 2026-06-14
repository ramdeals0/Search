import type { ProductDocument } from "@retailer-search/shared-types";
import { ProductSearchIndex } from "@retailer-search/search-core";
import { prisma } from "../db.js";
import {
  getProductCatalog,
  hydrateProductCatalog,
} from "../catalog-store.js";

const productIndex = new ProductSearchIndex();
let lastSyncAt: string | undefined;

export function getProductSearchIndex(): ProductSearchIndex {
  return productIndex;
}

export function getIndexLastSyncAt(): string | undefined {
  return lastSyncAt;
}

export async function rebuildProductSearchIndex(): Promise<number> {
  const count = await hydrateProductCatalog();
  productIndex.rebuild(getProductCatalog());
  lastSyncAt = new Date().toISOString();
  return count;
}

export async function syncProductSearchIndexDelta(): Promise<{
  upserted: number;
  removed: number;
}> {
  const since = lastSyncAt;
  await hydrateProductCatalog();

  let deltaProducts = getProductCatalog();
  if (since && prisma) {
    try {
      const rows = await prisma.product.findMany({
        where: { updatedAt: { gte: new Date(since) } },
        include: { brand: true, category: true },
        orderBy: { id: "asc" },
      });

      if (rows.length > 0 && rows.length < getProductCatalog().length) {
        deltaProducts = rows.map((row) => ({
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
          attributes: row.attributes as ProductDocument["attributes"],
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }));
      }
    } catch {
      // Fall back to full catalog sync when delta query fails.
    }
  }

  const result = productIndex.syncDelta(deltaProducts, since);
  lastSyncAt = new Date().toISOString();
  return result;
}

export function syncProductSearchIndexFromCatalog(): void {
  productIndex.rebuild(getProductCatalog());
  lastSyncAt = new Date().toISOString();
}
