import type { ProductDocument } from "@retailer-search/shared-types";
import type { Prisma, PrismaClient } from "@prisma/client";
import { SYNTHETIC_BRANDS } from "../seed-data/brands.js";
import { HOME_IMPROVEMENT_TAXONOMY } from "../seed-data/home-improvement-taxonomy.js";
import { generateSimpleProductBatch } from "./product-generator.js";

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

export async function clearCatalogTables(
  prisma: PrismaClient,
): Promise<void> {
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
}

async function ensureDefaultCatalogRecord(
  prisma: PrismaClient,
): Promise<void> {
  await prisma.catalog.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      tenantId: "default",
      slug: "default",
      name: "Default catalog",
      description: "Primary product catalog for this tenant",
      isDefault: true,
      active: true,
    },
    update: {},
  });
}

export async function seedCatalogTables(
  prisma: PrismaClient,
  products: ProductDocument[],
): Promise<{ brands: number; categories: number; products: number }> {
  await clearCatalogTables(prisma);
  await ensureDefaultCatalogRecord(prisma);

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

  await prisma.brand.createMany({
    data: Array.from(brandIds.entries()).map(([name, id]) => ({
      id,
      name,
    })),
  });

  await prisma.category.createMany({
    data: Array.from(categoryIds.entries()).map(([key, id]) => {
      const [department, subcategory] = key.split("::");
      return {
        id,
        department: department ?? "",
        subcategory: subcategory ?? "",
      };
    }),
  });

  const productRows: Prisma.ProductCreateManyInput[] = products.map((product) => ({
    id: product.id,
    sku: product.sku,
    title: product.title,
    brandId: brandIds.get(product.brand)!,
    categoryId: categoryIds.get(`${product.category}::${product.subcategory}`)!,
    catalogId: "default",
    description: product.description,
    price: product.price,
    inventory: product.inventory,
    inStock: product.inStock,
    unitCost: product.unitCost ?? null,
    profitMarginPercent: product.profitMarginPercent ?? null,
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

export async function seedLargeCatalogTables(
  prisma: PrismaClient,
  targetProductCount: number,
  seed: number,
): Promise<{ brands: number; categories: number; products: number }> {
  await clearCatalogTables(prisma);
  await ensureDefaultCatalogRecord(prisma);

  const brandIds = new Map<string, string>();
  const categoryIds = new Map<string, string>();

  for (const leaf of HOME_IMPROVEMENT_TAXONOMY) {
    const categoryKey = `${leaf.department}::${leaf.subcategory}`;
    if (!categoryIds.has(categoryKey)) {
      categoryIds.set(categoryKey, categoryIdFor(leaf.department, leaf.subcategory));
    }
  }

  for (const brand of SYNTHETIC_BRANDS) {
    brandIds.set(brand.name, brandIdForName(brand.name));
  }

  await prisma.brand.createMany({
    data: SYNTHETIC_BRANDS.map((brand) => ({
      id: brandIdForName(brand.name),
      name: brand.name,
    })),
  });

  await prisma.category.createMany({
    data: Array.from(categoryIds.entries()).map(([key, id]) => {
      const [department, subcategory] = key.split("::");
      return {
        id,
        department: department ?? "",
        subcategory: subcategory ?? "",
      };
    }),
  });

  let inserted = 0;
  const batchSize = DEFAULT_SEED_BATCH_SIZE;
  while (inserted < targetProductCount) {
    const currentBatchSize = Math.min(batchSize, targetProductCount - inserted);
    const batch = generateSimpleProductBatch(inserted + 1, currentBatchSize, seed);
    const productRows: Prisma.ProductCreateManyInput[] = batch.map((product) => ({
      id: product.id,
      sku: product.sku,
      title: product.title,
      brandId: brandIds.get(product.brand) ?? brandIdForName(product.brand),
      categoryId:
        categoryIds.get(`${product.category}::${product.subcategory}`) ??
        categoryIdFor(product.category, product.subcategory),
      catalogId: "default",
      description: product.description,
      price: product.price,
      inventory: product.inventory,
      inStock: product.inStock,
      imageUrl: product.imageUrl ?? null,
      attributes: product.attributes as Prisma.InputJsonValue,
      createdAt: new Date(product.createdAt),
      updatedAt: new Date(product.updatedAt),
    }));

    await prisma.product.createMany({ data: productRows });
    inserted += currentBatchSize;
    if (inserted % (batchSize * 10) === 0 || inserted === targetProductCount) {
      console.log(`Seeded ${inserted.toLocaleString()} / ${targetProductCount.toLocaleString()} products...`);
    }
  }

  return {
    brands: SYNTHETIC_BRANDS.length,
    categories: categoryIds.size,
    products: inserted,
  };
}
