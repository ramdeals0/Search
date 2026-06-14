import type {
  AdminProductListResponseDto,
  CatalogCsvImportResultDto,
  UpdateAdminProductRequestDto,
} from "@retailer-search/shared-types";
import { prisma } from "./db.js";

function toBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return undefined;
}

function parseCsv(csvText: string): Record<string, string>[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return [];
  }
  const headers = lines[0].split(",").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]] = cells[i] ?? "";
    }
    return row;
  });
}

export async function listAdminProducts(
  limit = 100,
): Promise<AdminProductListResponseDto> {
  const safeLimit = Math.max(1, Math.min(500, limit));
  const [total, rows] = await Promise.all([
    prisma.product.count(),
    prisma.product.findMany({
      include: { brand: true, category: true },
      orderBy: { updatedAt: "desc" },
      take: safeLimit,
    }),
  ]);

  return {
    total,
    products: rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      title: row.title,
      brand: row.brand.name,
      category: row.category.department,
      subcategory: row.category.subcategory,
      price: row.price,
      inStock: row.inStock,
    })),
  };
}

export async function updateAdminProduct(
  productId: string,
  patch: UpdateAdminProductRequestDto,
): Promise<AdminProductListResponseDto["products"][number] | undefined> {
  const existing = await prisma.product.findUnique({
    where: { id: productId },
    include: { brand: true, category: true },
  });
  if (!existing) {
    return undefined;
  }

  const inventory =
    patch.inventory !== undefined ? Math.max(0, Math.round(patch.inventory)) : undefined;
  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      title: patch.title ?? undefined,
      description: patch.description ?? undefined,
      price: patch.price ?? undefined,
      inventory,
      inStock:
        patch.inStock !== undefined
          ? patch.inStock
          : inventory !== undefined
            ? inventory > 0
            : undefined,
    },
    include: { brand: true, category: true },
  });

  return {
    id: updated.id,
    sku: updated.sku,
    title: updated.title,
    brand: updated.brand.name,
    category: updated.category.department,
    subcategory: updated.category.subcategory,
    price: updated.price,
    inStock: updated.inStock,
  };
}

export async function importProductsFromCsv(
  csvText: string,
): Promise<CatalogCsvImportResultDto> {
  const rows = parseCsv(csvText);
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    const lineNo = index + 2;
    const sku = row.sku?.trim();
    const id = row.id?.trim() || undefined;
    const title = row.title?.trim();
    const brandName = row.brand?.trim();
    const categoryName = row.category?.trim();
    const subcategory = row.subcategory?.trim() || "general";
    const description = row.description?.trim() || "";
    const price = Number(row.price);
    const inventory = Number(row.inventory ?? 0);
    const inStockParsed = toBoolean(row.inStock);

    if (
      !sku ||
      !title ||
      !brandName ||
      !categoryName ||
      !Number.isFinite(price) ||
      !Number.isFinite(inventory)
    ) {
      skipped += 1;
      errors.push(`Line ${lineNo}: missing required fields or invalid number`);
      continue;
    }

    try {
      const brandId = `brand-${brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const categoryId = `cat-${categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${subcategory.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

      await prisma.brand.upsert({
        where: { id: brandId },
        create: { id: brandId, name: brandName },
        update: { name: brandName },
      });

      await prisma.category.upsert({
        where: { id: categoryId },
        create: {
          id: categoryId,
          department: categoryName,
          subcategory,
        },
        update: {
          department: categoryName,
          subcategory,
        },
      });

      const existing = await prisma.product.findUnique({ where: { sku } });
      const nextId =
        id ?? existing?.id ?? `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const commonPayload = {
        sku,
        title,
        description,
        price,
        inventory: Math.max(0, Math.round(inventory)),
        inStock:
          inStockParsed !== undefined
            ? inStockParsed
            : Math.max(0, Math.round(inventory)) > 0,
        brandId,
        categoryId,
        attributes: {},
        updatedAt: new Date(),
      };

      if (existing) {
        await prisma.product.update({
          where: { sku },
          data: commonPayload,
        });
        updated += 1;
      } else {
        await prisma.product.create({
          data: {
            id: nextId,
            ...commonPayload,
            createdAt: new Date(),
          },
        });
        imported += 1;
      }
    } catch (error) {
      skipped += 1;
      errors.push(
        `Line ${lineNo}: failed to import (${error instanceof Error ? error.message : "unknown"})`,
      );
    }
  }

  return {
    imported,
    updated,
    skipped,
    errors,
  };
}
