import type {
  ProductDocument,
  SearchRequestDto,
  SearchResponseDto,
} from "@retailer-search/shared-types";
import { searchProducts, type SearchProductsOptions } from "./index.js";

export interface FederatedIndexSource {
  name: string;
  getProducts: () => ProductDocument[];
}

export interface FederatedSearchOptions extends SearchProductsOptions {
  sources: FederatedIndexSource[];
  mergeLimit?: number;
}

export function searchFederatedIndexes(
  request: SearchRequestDto,
  options: FederatedSearchOptions,
): SearchResponseDto {
  const started = Date.now();
  const mergedHits = new Map<
    string,
    SearchResponseDto["hits"][number] & { sourceIndexes: string[] }
  >();

  for (const source of options.sources) {
    const result = searchProducts(source.getProducts(), request, options);
    for (const hit of result.hits) {
      const existing = mergedHits.get(hit.id);
      if (!existing || hit.score > existing.score) {
        mergedHits.set(hit.id, {
          ...hit,
          sourceIndexes: existing
            ? [...new Set([...existing.sourceIndexes, source.name])]
            : [source.name],
        });
      }
    }
  }

  const hits = Array.from(mergedHits.values())
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, options.mergeLimit ?? request.pageSize);

  const page = Math.max(1, request.page);
  const pageSize = Math.max(1, Math.min(100, request.pageSize));
  const totalHits = hits.length;
  const offset = (page - 1) * pageSize;

  return {
    query: request.query,
    normalizedQuery: request.query.trim().toLowerCase(),
    page,
    pageSize,
    totalHits,
    totalPages: Math.max(1, Math.ceil(totalHits / pageSize)),
    processingTimeMs: Date.now() - started,
    hits: hits.slice(offset, offset + pageSize),
    availableFacets: {
      brand: [],
      category: [],
      inStock: [],
    },
  };
}
