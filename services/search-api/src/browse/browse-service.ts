import type {
  BrowseCategoryDto,
  BrowseHitDto,
  BrowseRequestDto,
  BrowseResponseDto,
  ProductDocument,
} from "@retailer-search/shared-types";
import type { ProductSearchIndexStats } from "@retailer-search/search-core";
import { getProductSearchIndex } from "../index/product-index-manager.js";

function toHit(product: ProductDocument): BrowseHitDto {
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
}

function matchesBrowseFilters(
  product: ProductDocument,
  request: BrowseRequestDto,
): boolean {
  if (request.category && product.category !== request.category) {
    return false;
  }
  if (request.brand && product.brand !== request.brand) {
    return false;
  }
  if (request.inStock !== undefined && product.inStock !== request.inStock) {
    return false;
  }
  return true;
}

function sortProducts(
  products: ProductDocument[],
  sort: BrowseRequestDto["sort"],
): ProductDocument[] {
  const sorted = [...products];
  switch (sort) {
    case "price_asc":
      return sorted.sort((a, b) => a.price - b.price || a.title.localeCompare(b.title));
    case "price_desc":
      return sorted.sort((a, b) => b.price - a.price || a.title.localeCompare(b.title));
    case "title_asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "relevance":
    default:
      return sorted.sort((a, b) => {
        if (a.inStock !== b.inStock) {
          return a.inStock ? -1 : 1;
        }
        return a.title.localeCompare(b.title);
      });
  }
}

export function browseProducts(
  products: ProductDocument[],
  request: BrowseRequestDto,
): BrowseResponseDto {
  const started = Date.now();
  const page = Math.max(1, request.page);
  const pageSize = Math.max(1, Math.min(100, request.pageSize));

  const filtered = sortProducts(
    products.filter((product) => matchesBrowseFilters(product, request)),
    request.sort ?? "relevance",
  );

  const totalHits = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalHits / pageSize));
  const offset = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    totalHits,
    totalPages,
    processingTimeMs: Date.now() - started,
    hits: filtered.slice(offset, offset + pageSize).map(toHit),
  };
}

export function listBrowseCategories(
  products: ProductDocument[],
): BrowseCategoryDto[] {
  const byCategory = new Map<string, Map<string, number>>();

  for (const product of products) {
    let subcategories = byCategory.get(product.category);
    if (!subcategories) {
      subcategories = new Map<string, number>();
      byCategory.set(product.category, subcategories);
    }
    subcategories.set(
      product.subcategory,
      (subcategories.get(product.subcategory) ?? 0) + 1,
    );
  }

  return Array.from(byCategory.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, subcategories]) => {
      const subcategoryNames = Array.from(subcategories.keys()).sort();
      const productCount = Array.from(subcategories.values()).reduce(
        (sum, count) => sum + count,
        0,
      );
      return {
        category,
        subcategories: subcategoryNames,
        productCount,
      };
    });
}

export function browseCategoriesResponse(products: ProductDocument[]): {
  categories: BrowseCategoryDto[];
  indexStats: ProductSearchIndexStats;
} {
  return {
    categories: listBrowseCategories(products),
    indexStats: getProductSearchIndex().getStats(),
  };
}
