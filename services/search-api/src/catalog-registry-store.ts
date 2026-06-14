import type {
  CatalogDto,
  CreateCatalogRequestDto,
  UpdateCatalogRequestDto,
} from "@retailer-search/shared-types";
import { prisma } from "./db.js";

function toDto(
  row: {
    id: string;
    tenantId: string;
    slug: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  productCount?: number,
): CatalogDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    isDefault: row.isDefault,
    active: row.active,
    productCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCatalogs(tenantId?: string): Promise<CatalogDto[]> {
  const rows = await prisma.catalog.findMany({
    where: tenantId ? { tenantId } : undefined,
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  const counts = await prisma.product.groupBy({
    by: ["catalogId"],
    _count: { _all: true },
  });
  const countByCatalog = new Map(
    counts.map((entry) => [entry.catalogId, entry._count._all]),
  );

  return rows.map((row) => toDto(row, countByCatalog.get(row.id) ?? 0));
}

export async function getCatalogById(id: string): Promise<CatalogDto | null> {
  const row = await prisma.catalog.findUnique({ where: { id } });
  if (!row) {
    return null;
  }
  const productCount = await prisma.product.count({ where: { catalogId: id } });
  return toDto(row, productCount);
}

export async function createCatalog(
  request: CreateCatalogRequestDto,
): Promise<CatalogDto> {
  const tenantId = request.tenantId?.trim() || "default";
  const slug = request.slug.trim().toLowerCase();

  if (request.isDefault) {
    await prisma.catalog.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const row = await prisma.catalog.create({
    data: {
      tenantId,
      slug,
      name: request.name.trim(),
      description: request.description?.trim() || null,
      isDefault: request.isDefault ?? false,
      active: true,
    },
  });

  return toDto(row, 0);
}

export async function updateCatalog(
  id: string,
  request: UpdateCatalogRequestDto,
): Promise<CatalogDto | null> {
  const existing = await prisma.catalog.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }

  if (request.isDefault) {
    await prisma.catalog.updateMany({
      where: { tenantId: existing.tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const row = await prisma.catalog.update({
    where: { id },
    data: {
      name: request.name?.trim(),
      description:
        request.description === undefined
          ? undefined
          : request.description.trim() || null,
      active: request.active,
      isDefault: request.isDefault,
    },
  });

  const productCount = await prisma.product.count({ where: { catalogId: id } });
  return toDto(row, productCount);
}

export async function ensureDefaultCatalog(): Promise<void> {
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

export async function resolveCatalogId(
  catalogIdOrSlug: string | undefined,
  tenantId = "default",
): Promise<string> {
  if (!catalogIdOrSlug?.trim()) {
    const defaultCatalog = await prisma.catalog.findFirst({
      where: { tenantId, isDefault: true, active: true },
      select: { id: true },
    });
    return defaultCatalog?.id ?? "default";
  }

  const value = catalogIdOrSlug.trim();
  const byId = await prisma.catalog.findUnique({ where: { id: value } });
  if (byId?.active) {
    return byId.id;
  }

  const bySlug = await prisma.catalog.findUnique({
    where: { tenantId_slug: { tenantId, slug: value.toLowerCase() } },
  });
  if (bySlug?.active) {
    return bySlug.id;
  }

  return "default";
}
