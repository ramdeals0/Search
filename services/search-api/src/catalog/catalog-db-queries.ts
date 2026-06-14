import type {
  AutocompleteSuggestionDto,
  BrowseCategoryDto,
  BrowseRequestDto,
  BrowseResponseDto,
  ProductAttributeMap,
  ProductDocument,
  SearchFiltersDto,
} from "@retailer-search/shared-types";
import { prisma } from "../db.js";
import {
  getVectorSearchRuntimeConfig,
  vectorDistanceOperator,
  vectorScoreSql,
} from "../ai-search/vector-config.js";
import {
  CATALOG_BROWSE_MAX_PAGE_SIZE,
  CATALOG_SEARCH_CANDIDATE_LIMIT,
} from "./catalog-scale-config.js";

const PRODUCT_LEXICAL_SEARCH_VECTOR_SQL = `
  to_tsvector(
    'english',
    coalesce(p.title, '') || ' ' ||
    coalesce(p.description, '') || ' ' ||
    coalesce(p.sku, '') || ' ' ||
    coalesce(b.name, '') || ' ' ||
    coalesce(c.department, '') || ' ' ||
    coalesce(c.subcategory, '') || ' ' ||
    coalesce(p.attributes::text, '')
  )
`;

const prismaClient = prisma as any;

export interface ProductRowWithRelations {
  id: string;
  sku: string;
  title: string;
  description: string;
  price: number;
  inventory: number;
  inStock: boolean;
  imageUrl: string | null;
  attributes: unknown;
  catalogId: string;
  createdAt: Date;
  updatedAt: Date;
  brand: { name: string };
  category: { department: string; subcategory: string };
}

export function mapProductRow(row: ProductRowWithRelations): ProductDocument {
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
    catalogId: row.catalogId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const productInclude = {
  brand: true,
  category: true,
} as const;

function resolveCatalogFilter(catalogId?: string): string {
  const value = catalogId?.trim();
  if (!value || value === "default") {
    return "default";
  }
  return value;
}

export async function countProductsInDatabase(catalogId?: string): Promise<number> {
  if (!catalogId || catalogId === "default") {
    return prisma.product.count({ where: { catalogId: "default" } });
  }
  return prisma.product.count({ where: { catalogId } });
}

export async function countAllProductsInDatabase(): Promise<number> {
  return prisma.product.count();
}

export async function fetchProductById(productId: string): Promise<ProductDocument | null> {
  const row = await prisma.product.findUnique({
    where: { id: productId },
    include: productInclude,
  });
  return row ? mapProductRow(row as ProductRowWithRelations) : null;
}

export async function fetchProductsByIds(productIds: string[]): Promise<ProductDocument[]> {
  if (productIds.length === 0) {
    return [];
  }
  const rows = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: productInclude,
  });
  const byId = new Map(rows.map((row) => [row.id, mapProductRow(row as ProductRowWithRelations)]));
  return productIds
    .map((id) => byId.get(id))
    .filter((product): product is ProductDocument => Boolean(product));
}

function buildFilterSql(
  filters: SearchFiltersDto | undefined,
  catalogId: string,
  startParamIndex: number,
): { clause: string; params: unknown[] } {
  const clauses: string[] = [`(p."catalogId" = $${startParamIndex})`];
  const params: unknown[] = [catalogId];
  let index = startParamIndex + 1;

  for (const brand of filters?.brand ?? []) {
    clauses.push(`b.name = $${index}`);
    params.push(brand);
    index += 1;
  }
  for (const category of filters?.category ?? []) {
    clauses.push(`c.department = $${index}`);
    params.push(category);
    index += 1;
  }
  for (const inStock of filters?.inStock ?? []) {
    clauses.push(`p."inStock" = $${index}`);
    params.push(inStock === "true");
    index += 1;
  }

  return { clause: clauses.join(" AND "), params };
}

export async function fetchSearchCandidatesFromDatabase(input: {
  query: string;
  catalogId?: string;
  filters?: SearchFiltersDto;
  limit?: number;
}): Promise<ProductDocument[]> {
  const trimmed = input.query.trim();
  const limit = Math.min(
    input.limit ?? CATALOG_SEARCH_CANDIDATE_LIMIT,
    CATALOG_SEARCH_CANDIDATE_LIMIT,
  );
  const catalog = resolveCatalogFilter(input.catalogId);

  if (!trimmed) {
    const rows = await prisma.product.findMany({
      where: buildPrismaBrowseWhere(catalog, input.filters),
      include: productInclude,
      orderBy: [{ inStock: "desc" }, { title: "asc" }],
      take: limit,
    });
    return rows.map((row) => mapProductRow(row as ProductRowWithRelations));
  }

  const { clause, params } = buildFilterSql(input.filters, catalog, 2);
  const sql = `
    SELECT p.id
    FROM "Product" p
    INNER JOIN "Brand" b ON p."brandId" = b.id
    INNER JOIN "Category" c ON p."categoryId" = c.id
    WHERE ${clause}
      AND (
        ${PRODUCT_LEXICAL_SEARCH_VECTOR_SQL} @@ plainto_tsquery('english', $1)
        OR p.title ILIKE '%' || $1 || '%'
        OR p.description ILIKE '%' || $1 || '%'
        OR p.sku ILIKE '%' || $1 || '%'
        OR b.name ILIKE '%' || $1 || '%'
        OR c.department ILIKE '%' || $1 || '%'
        OR c.subcategory ILIKE '%' || $1 || '%'
        OR p.attributes::text ILIKE '%' || $1 || '%'
      )
    ORDER BY ts_rank(${PRODUCT_LEXICAL_SEARCH_VECTOR_SQL}, plainto_tsquery('english', $1)) DESC,
    p."inStock" DESC,
    p.title ASC
    LIMIT ${limit}
  `;

  const idRows = (await prisma.$queryRawUnsafe(sql, trimmed, ...params)) as Array<{ id: string }>;
  return fetchProductsByIds(idRows.map((row) => row.id));
}

function buildPrismaBrowseWhere(
  catalogId: string,
  filters?: SearchFiltersDto,
  request?: BrowseRequestDto,
): Record<string, unknown> {
  const where: Record<string, unknown> = {
    catalogId,
  };

  if (request?.category) {
    where.category = { department: request.category };
  } else if (filters?.category?.[0]) {
    where.category = { department: filters.category[0] };
  }

  if (request?.brand) {
    where.brand = { name: request.brand };
  } else if (filters?.brand?.[0]) {
    where.brand = { name: filters.brand[0] };
  }

  if (request?.inStock !== undefined) {
    where.inStock = request.inStock;
  } else if (filters?.inStock?.[0]) {
    where.inStock = filters.inStock[0] === "true";
  }

  return where;
}

export async function browseProductsFromDatabase(
  request: BrowseRequestDto,
  catalogId?: string,
): Promise<BrowseResponseDto> {
  const started = Date.now();
  const page = Math.max(1, request.page);
  const pageSize = Math.max(1, Math.min(CATALOG_BROWSE_MAX_PAGE_SIZE, request.pageSize));
  const catalog = resolveCatalogFilter(catalogId);
  const where = buildPrismaBrowseWhere(catalog, undefined, request);

  const orderBy =
    request.sort === "price_asc"
      ? [{ price: "asc" as const }, { title: "asc" as const }]
      : request.sort === "price_desc"
        ? [{ price: "desc" as const }, { title: "asc" as const }]
        : request.sort === "title_asc"
          ? [{ title: "asc" as const }]
          : [{ inStock: "desc" as const }, { title: "asc" as const }];

  const [totalHits, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    page,
    pageSize,
    totalHits,
    totalPages: Math.max(1, Math.ceil(totalHits / pageSize)),
    processingTimeMs: Date.now() - started,
    hits: rows.map((row) => {
      const product = mapProductRow(row as ProductRowWithRelations);
      return {
        id: product.id,
        sku: product.sku,
        title: product.title,
        brand: product.brand,
        category: product.category,
        subcategory: product.subcategory,
        description: product.description,
        price: product.price,
        imageUrl: product.imageUrl,
        inStock: product.inStock,
      };
    }),
  };
}

export async function listBrowseCategoriesFromDatabase(
  catalogId?: string,
): Promise<BrowseCategoryDto[]> {
  const catalog = resolveCatalogFilter(catalogId);
  const rows = (await prisma.$queryRawUnsafe(
    `
    SELECT c.department AS category,
           array_agg(DISTINCT c.subcategory ORDER BY c.subcategory) AS subcategories,
           COUNT(*)::int AS product_count
    FROM "Product" p
    INNER JOIN "Category" c ON p."categoryId" = c.id
    WHERE p."catalogId" = $1
    GROUP BY c.department
    ORDER BY c.department ASC
    `,
    catalog,
  )) as Array<{
    category: string;
    subcategories: string[];
    product_count: number;
  }>;

  return rows.map((row) => ({
    category: row.category,
    subcategories: row.subcategories ?? [],
    productCount: row.product_count,
  }));
}

export async function autocompleteFromDatabase(
  query: string,
  catalogId?: string,
  limit = 8,
): Promise<AutocompleteSuggestionDto[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const catalog = resolveCatalogFilter(catalogId);
  const containsPattern = `%${trimmed}%`;
  const prefixPattern = `${trimmed}%`;

  const [products, brands, categories] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ title: string }>>(
      `
      SELECT title
      FROM (
        SELECT DISTINCT
          p.title AS title,
          CASE WHEN p.title ILIKE $1 THEN 0 ELSE 1 END AS rank_order
        FROM "Product" p
        WHERE p."catalogId" = $4
          AND (
            p.title ILIKE $1
            OR p.title ILIKE $2
            OR p.description ILIKE $2
            OR p.attributes::text ILIKE $2
          )
      ) ranked
      ORDER BY rank_order ASC, title ASC
      LIMIT $3
      `,
      prefixPattern,
      containsPattern,
      limit,
      catalog,
    ),
    prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `
      SELECT name
      FROM (
        SELECT DISTINCT
          b.name AS name,
          CASE WHEN b.name ILIKE $1 THEN 0 ELSE 1 END AS rank_order
        FROM "Brand" b
        INNER JOIN "Product" p ON p."brandId" = b.id
        WHERE p."catalogId" = $4
          AND (
            b.name ILIKE $1
            OR b.name ILIKE $2
          )
      ) ranked
      ORDER BY rank_order ASC, name ASC
      LIMIT $3
      `,
      prefixPattern,
      containsPattern,
      Math.max(2, Math.floor(limit / 2)),
      catalog,
    ),
    prisma.$queryRawUnsafe<Array<{ department: string }>>(
      `
      SELECT department
      FROM (
        SELECT DISTINCT
          c.department AS department,
          CASE WHEN c.department ILIKE $1 THEN 0 ELSE 1 END AS rank_order
        FROM "Category" c
        INNER JOIN "Product" p ON p."categoryId" = c.id
        WHERE p."catalogId" = $4
          AND (
            c.department ILIKE $1
            OR c.department ILIKE $2
          )
      ) ranked
      ORDER BY rank_order ASC, department ASC
      LIMIT $3
      `,
      prefixPattern,
      containsPattern,
      Math.max(2, Math.floor(limit / 2)),
      catalog,
    ),
  ]);

  const suggestions: AutocompleteSuggestionDto[] = [];
  for (const row of products) {
    suggestions.push({ value: row.title, type: "product" });
  }
  for (const row of brands) {
    suggestions.push({ value: row.name, type: "brand" });
  }
  for (const row of categories) {
    suggestions.push({ value: row.department, type: "category" });
  }
  suggestions.push({ value: trimmed, type: "query" });
  return suggestions.slice(0, limit);
}

export async function countProductEmbeddingsInDatabase(): Promise<number> {
  return prismaClient.productEmbedding.count();
}

export async function forEachProductBatchFromDatabase(
  handler: (products: ProductDocument[]) => Promise<void>,
  options: {
    batchSize?: number;
    productIds?: string[];
    catalogId?: string;
  } = {},
): Promise<number> {
  const batchSize = options.batchSize ?? 1000;
  let cursor: string | undefined;
  let processed = 0;

  for (;;) {
    const rows = await prisma.product.findMany({
      where: {
        ...(options.productIds?.length
          ? { id: { in: options.productIds } }
          : { catalogId: resolveCatalogFilter(options.catalogId) }),
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      include: productInclude,
      orderBy: { id: "asc" },
      take: batchSize,
    });

    if (rows.length === 0) {
      break;
    }

    const products = rows.map((row) => mapProductRow(row as ProductRowWithRelations));
    await handler(products);
    processed += products.length;
    cursor = rows[rows.length - 1]?.id;

    if (options.productIds?.length) {
      break;
    }
  }

  return processed;
}

export async function isPgVectorAvailable(): Promise<boolean> {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT 1 AS ok FROM pg_extension WHERE extname = 'vector' LIMIT 1`,
    )) as Array<{ ok: number }>;
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function searchEmbeddingsFromDatabase(
  queryVector: number[],
  limit: number,
  candidateProductIds?: string[],
): Promise<Array<{ productId: string; score: number }>> {
  const vectorConfig = getVectorSearchRuntimeConfig();
  if (!vectorConfig.pgvectorEnabled) {
    return [];
  }

  const vectorLiteral = `[${queryVector.join(",")}]`;
  const cappedLimit = Math.max(1, Math.min(limit, 500));
  const distanceOp = vectorDistanceOperator(vectorConfig.distanceMetric);
  const scoreExpr = vectorScoreSql(distanceOp);

  // IVFFlat recall tuning: SET ivfflat.probes before query (default from VECTOR_QUERY_PROBES).
  if (vectorConfig.indexType === "ivfflat" && vectorConfig.queryProbes > 0) {
    await prisma.$executeRawUnsafe(
      `SET LOCAL ivfflat.probes = ${vectorConfig.queryProbes}`,
    );
  }
  // HNSW recall tuning: SET hnsw.ef_search (VECTOR_QUERY_EF_SEARCH).
  if (vectorConfig.indexType === "hnsw" && vectorConfig.queryEfSearch > 0) {
    await prisma.$executeRawUnsafe(
      `SET LOCAL hnsw.ef_search = ${vectorConfig.queryEfSearch}`,
    );
  }

  if (candidateProductIds && candidateProductIds.length > 0) {
    const rows = (await prisma.$queryRawUnsafe(
      `
      SELECT pe."productId" AS product_id,
             ${scoreExpr} AS score
      FROM "ProductEmbedding" pe
      WHERE pe."productId" = ANY($2::text[])
        AND pe."embeddingVector" IS NOT NULL
      ORDER BY pe."embeddingVector" ${distanceOp} $1::vector
      LIMIT $3
      `,
      vectorLiteral,
      candidateProductIds,
      cappedLimit,
    )) as Array<{ product_id: string; score: number }>;
    return rows.map((row) => ({ productId: row.product_id, score: Number(row.score) }));
  }

  const pgvector = await isPgVectorAvailable();
  if (!pgvector) {
    return [];
  }

  const rows = (await prisma.$queryRawUnsafe(
    `
    SELECT pe."productId" AS product_id,
           ${scoreExpr} AS score
    FROM "ProductEmbedding" pe
    WHERE pe."embeddingVector" IS NOT NULL
    ORDER BY pe."embeddingVector" ${distanceOp} $1::vector
    LIMIT $2
    `,
    vectorLiteral,
    cappedLimit,
  )) as Array<{ product_id: string; score: number }>;

  return rows.map((row) => ({ productId: row.product_id, score: Number(row.score) }));
}

export async function syncEmbeddingVectorColumn(
  productId: string,
  vector: number[],
  metadata?: { sourceText?: string; textHash?: string },
): Promise<void> {
  const vectorLiteral = `[${vector.join(",")}]`;
  await prisma.$executeRawUnsafe(
    `
    UPDATE "ProductEmbedding"
    SET
      "embeddingVector" = $1::vector,
      "sourceText" = COALESCE($3, "sourceText"),
      "lastIndexedAt" = NOW()
    WHERE "productId" = $2
    `,
    vectorLiteral,
    productId,
    metadata?.sourceText ?? null,
  );
}
