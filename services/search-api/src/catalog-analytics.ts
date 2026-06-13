import type {
  CatalogAnalyticsInsightsDto,
  ProductDocument,
  SearchClickEventDto,
  TopBrandInsightDto,
  TopCategoryInsightDto,
  TopProductInsightDto,
  TopQueryDto,
} from "@retailer-search/shared-types";
import { getAnalyticsSummary, getClickEventsForInsights, getQueryAnalytics } from "./analytics-store.js";
import { DEMO_HERO_QUERIES } from "./demo-search-config.js";

function readPopularity(product: ProductDocument): number {
  const score = product.attributes?.popularityScore;
  return typeof score === "number" ? score : 0;
}

function buildTopProductsFromCatalog(
  products: ProductDocument[],
  limit: number,
): TopProductInsightDto[] {
  return [...products]
    .sort((a, b) => readPopularity(b) - readPopularity(a))
    .slice(0, limit)
    .map((product) => ({
      productId: product.id,
      title: product.title,
      brand: product.brand,
      category: product.category,
      count: Math.round(readPopularity(product)),
      source: "popularity" as const,
    }));
}

function buildTopCategoriesFromCatalog(
  products: ProductDocument[],
  limit: number,
): TopCategoryInsightDto[] {
  const totals = new Map<string, number>();

  for (const product of products) {
    totals.set(
      product.category,
      (totals.get(product.category) ?? 0) + readPopularity(product),
    );
  }

  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category, count]) => ({
      category,
      count: Math.round(count),
      source: "popularity" as const,
    }));
}

function buildTopQueriesFromDemo(limit: number): TopQueryDto[] {
  return DEMO_HERO_QUERIES.slice(0, limit).map((hero, index) => ({
    query: hero.query,
    count: Math.max(limit - index, 1),
  }));
}

function buildTopBrandsFromCatalog(
  products: ProductDocument[],
  limit: number,
): TopBrandInsightDto[] {
  const totals = new Map<string, number>();

  for (const product of products) {
    totals.set(
      product.brand,
      (totals.get(product.brand) ?? 0) + readPopularity(product),
    );
  }

  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([brand, count]) => ({
      brand,
      count: Math.round(count),
      source: "popularity" as const,
    }));
}

function buildTopBrandsFromProducts(
  products: TopProductInsightDto[],
  limit: number,
): TopBrandInsightDto[] {
  const totals = new Map<string, number>();

  for (const product of products) {
    totals.set(product.brand, (totals.get(product.brand) ?? 0) + product.count);
  }

  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([brand, count]) => ({
      brand,
      count,
      source: "popularity" as const,
    }));
}

function matchBrandFromQuery(
  query: string,
  brandNames: Set<string>,
): string | undefined {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  for (const brand of brandNames) {
    const brandLower = brand.toLowerCase();
    if (normalized === brandLower || normalized.includes(brandLower)) {
      return brand;
    }
  }

  return undefined;
}

function buildTopBrandsFromSearches(
  queryRows: ReturnType<typeof getQueryAnalytics>,
  brandNames: Set<string>,
  limit: number,
): TopBrandInsightDto[] {
  const totals = new Map<string, number>();

  for (const row of queryRows) {
    const brand = matchBrandFromQuery(row.displayQuery, brandNames);
    if (!brand) {
      continue;
    }
    totals.set(brand, (totals.get(brand) ?? 0) + row.searches);
  }

  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([brand, count]) => ({
      brand,
      count,
      source: "searches" as const,
    }));
}

function buildTopCategoriesFromSearches(
  products: ProductDocument[],
  queryRows: ReturnType<typeof getQueryAnalytics>,
  limit: number,
): TopCategoryInsightDto[] {
  const categoryByTerm = new Map<string, string>();

  for (const product of products) {
    categoryByTerm.set(product.category.toLowerCase(), product.category);
    categoryByTerm.set(product.subcategory.toLowerCase(), product.category);
    const productType = product.attributes?.productType;
    if (typeof productType === "string" && productType.length > 0) {
      categoryByTerm.set(productType.toLowerCase(), product.category);
    }
  }

  const totals = new Map<string, number>();

  for (const row of queryRows) {
    const normalized = row.displayQuery.trim().toLowerCase();
    let matchedCategory: string | undefined;

    for (const [term, category] of categoryByTerm.entries()) {
      if (normalized.includes(term)) {
        matchedCategory = category;
        break;
      }
    }

    if (!matchedCategory) {
      continue;
    }

    totals.set(matchedCategory, (totals.get(matchedCategory) ?? 0) + row.searches);
  }

  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category, count]) => ({
      category,
      count,
      source: "searches" as const,
    }));
}

function resolveProductFromClick(
  click: SearchClickEventDto,
  productById: Map<string, ProductDocument>,
  products: ProductDocument[],
): ProductDocument | undefined {
  return (
    productById.get(click.productId) ??
    products.find(
      (candidate) => candidate.title.toLowerCase() === click.productTitle.toLowerCase(),
    )
  );
}

export function getCatalogAnalyticsInsights(
  products: ProductDocument[],
  limit = 10,
): CatalogAnalyticsInsightsDto {
  const summary = getAnalyticsSummary();
  const queryRows = getQueryAnalytics();
  const clicks = getClickEventsForInsights();
  const productById = new Map(products.map((product) => [product.id, product]));
  const brandNames = new Set(products.map((product) => product.brand));

  const productCounts = new Map<string, number>();
  const brandClickCounts = new Map<string, number>();
  const categoryClickCounts = new Map<string, number>();
  const clickTitleByProductId = new Map<string, string>();

  for (const click of clicks) {
    productCounts.set(click.productId, (productCounts.get(click.productId) ?? 0) + 1);
    clickTitleByProductId.set(click.productId, click.productTitle);

    const product = resolveProductFromClick(click, productById, products);
    if (!product) {
      continue;
    }

    brandClickCounts.set(product.brand, (brandClickCounts.get(product.brand) ?? 0) + 1);
    categoryClickCounts.set(
      product.category,
      (categoryClickCounts.get(product.category) ?? 0) + 1,
    );
  }

  let topProducts: TopProductInsightDto[] = Array.from(productCounts.entries())
    .map(([productId, count]) => {
      const product = productById.get(productId);
      return {
        productId,
        title: product?.title ?? clickTitleByProductId.get(productId) ?? productId,
        brand: product?.brand ?? "Unknown",
        category: product?.category ?? "Unknown",
        count,
        source: "clicks" as const,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  if (topProducts.length === 0) {
    topProducts = buildTopProductsFromCatalog(products, limit);
  }

  let topBrands: TopBrandInsightDto[] = Array.from(brandClickCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([brand, count]) => ({
      brand,
      count,
      source: "clicks" as const,
    }));

  if (topBrands.length === 0) {
    topBrands = buildTopBrandsFromSearches(queryRows, brandNames, limit);
  }

  if (topBrands.length === 0) {
    topBrands = buildTopBrandsFromProducts(topProducts, limit);
  }

  if (topBrands.length < limit) {
    const seen = new Set(topBrands.map((row) => row.brand));
    for (const candidate of buildTopBrandsFromCatalog(products, limit)) {
      if (seen.has(candidate.brand)) {
        continue;
      }
      topBrands.push(candidate);
      seen.add(candidate.brand);
      if (topBrands.length >= limit) {
        break;
      }
    }
  }

  let topCategories: TopCategoryInsightDto[] = Array.from(categoryClickCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category, count]) => ({
      category,
      count,
      source: "clicks" as const,
    }));

  if (topCategories.length === 0) {
    topCategories = buildTopCategoriesFromSearches(products, queryRows, limit);
  }

  if (topCategories.length === 0) {
    topCategories = buildTopCategoriesFromCatalog(products, limit);
  }

  let topQueries = summary.topQueries.slice(0, limit);

  if (topQueries.length === 0) {
    topQueries = buildTopQueriesFromDemo(limit);
  }

  return {
    topProducts,
    topBrands,
    topQueries,
    topCategories,
  };
}
