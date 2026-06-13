import type { ProductDocument } from "@retailer-search/shared-types";
import type { Prisma, PrismaClient } from "@prisma/client";

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

export async function seedCatalogTables(
  prisma: PrismaClient,
  products: ProductDocument[],
): Promise<{ brands: number; categories: number; products: number }> {
  await clearCatalogTables(prisma);

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
    description: product.description,
    price: product.price,
    inventory: product.inventory,
    inStock: product.inStock,
    imageUrl: product.imageUrl ?? null,
    attributes: product.attributes as Prisma.InputJsonValue,
    createdAt: new Date(product.createdAt),
    updatedAt: new Date(product.updatedAt),
  }));

  for (const batch of chunk(productRows, 100)) {
    await prisma.product.createMany({ data: batch });
  }

  return {
    brands: brandIds.size,
    categories: categoryIds.size,
    products: products.length,
  };
}
