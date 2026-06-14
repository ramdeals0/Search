import type { ProductDocument } from "@retailer-search/shared-types";
import type { Prisma, PrismaClient } from "@prisma/client";
import { LUXURY_CATALOG_ID } from "../../src/luxury-search-config.js";

const DEFAULT_SEED_BATCH_SIZE = readSeedBatchSize();

function readSeedBatchSize(): number {
  const raw = process.env.CATALOG_SEED_BATCH_SIZE;
  if (!raw) {
    return 2000;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2000;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function brandIdForName(name: string): string {
  return `brand-${slugify(name) || "unknown"}`;
}

function categoryIdFor(department: string, subcategory: string): string {
  return `cat-${slugify(department)}-${slugify(subcategory)}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

export async function ensureLuxuryCatalogRecord(
  prisma: PrismaClient,
): Promise<void> {
  await prisma.catalog.upsert({
    where: { id: LUXURY_CATALOG_ID },
    create: {
      id: LUXURY_CATALOG_ID,
      tenantId: "default",
      slug: "luxury-clothing",
      name: "Luxe Atelier Collection",
      description: "Luxury clothing and accessories catalog for multi-tenant validation",
      isDefault: false,
      active: true,
    },
    update: {
      name: "Luxe Atelier Collection",
      description: "Luxury clothing and accessories catalog for multi-tenant validation",
      active: true,
    },
  });
}

export async function clearLuxuryCatalogProducts(
  prisma: PrismaClient,
): Promise<number> {
  const result = await prisma.product.deleteMany({
    where: { catalogId: LUXURY_CATALOG_ID },
  });
  return result.count;
}

export async function seedLuxuryCatalogTables(
  prisma: PrismaClient,
  products: ProductDocument[],
): Promise<{ brands: number; categories: number; products: number }> {
  await ensureLuxuryCatalogRecord(prisma);
  await clearLuxuryCatalogProducts(prisma);

  const brandIds = new Map<string, string>();
  const categoryIds = new Map<string, string>();

  for (const product of products) {
    if (!brandIds.has(product.brand)) {
      brandIds.set(product.brand, brandIdForName(product.brand));
    }

    const categoryKey = `${product.category}::${product.subcategory}`;
    if (!categoryIds.has(categoryKey)) {
      categoryIds.set(
        categoryKey,
        categoryIdFor(product.category, product.subcategory),
      );
    }
  }

  for (const [name, id] of brandIds.entries()) {
    await prisma.brand.upsert({
      where: { id },
      create: { id, name },
      update: { name },
    });
  }

  for (const [key, id] of categoryIds.entries()) {
    const [department, subcategory] = key.split("::");
    await prisma.category.upsert({
      where: { id },
      create: {
        id,
        department: department ?? "",
        subcategory: subcategory ?? "",
      },
      update: {
        department: department ?? "",
        subcategory: subcategory ?? "",
      },
    });
  }

  const productRows: Prisma.ProductCreateManyInput[] = products.map((product) => ({
    id: product.id,
    sku: product.sku,
    title: product.title,
    brandId: brandIds.get(product.brand)!,
    categoryId: categoryIds.get(`${product.category}::${product.subcategory}`)!,
    catalogId: LUXURY_CATALOG_ID,
    description: product.description,
    price: product.price,
    inventory: product.inventory,
    inStock: product.inStock,
    imageUrl: product.imageUrl ?? null,
    attributes: product.attributes as Prisma.InputJsonValue,
    createdAt: new Date(product.createdAt),
    updatedAt: new Date(product.updatedAt),
  }));

  for (const batch of chunk(productRows, DEFAULT_SEED_BATCH_SIZE)) {
    await prisma.product.createMany({ data: batch });
  }

  return {
    brands: brandIds.size,
    categories: categoryIds.size,
    products: products.length,
  };
}
