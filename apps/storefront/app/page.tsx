import type {
  BrowseCategoryDto,
  SearchFiltersDto,
  SearchResponseDto,
} from "@retailer-search/shared-types";
import { Suspense } from "react";
import { HomeHero } from "./components/home-hero";
import { EmptyState } from "./empty-state";
import { Filters } from "./filters";
import { SearchResults } from "./search-results";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<SearchParams>;
}

function readParam(
  params: SearchParams,
  key: string,
  fallback: string,
): string {
  const value = params[key];
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

function readRepeatedParam(params: SearchParams, key: string): string[] {
  const value = params[key];
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map(String).filter((item) => item.length > 0);
  }
  const single = String(value).trim();
  return single.length > 0 ? [single] : [];
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildActiveFilters(params: SearchParams): SearchFiltersDto {
  const filters: SearchFiltersDto = {};
  const brand = readRepeatedParam(params, "brand");
  const category = readRepeatedParam(params, "category");
  const inStock = readRepeatedParam(params, "inStock");

  if (brand.length > 0) {
    filters.brand = brand;
  }
  if (category.length > 0) {
    filters.category = category;
  }
  if (inStock.length > 0) {
    filters.inStock = inStock;
  }

  return filters;
}

async function fetchBrowseCategories(): Promise<BrowseCategoryDto[]> {
  try {
    const response = await fetch(`${SEARCH_API_URL}/api/v1/browse/categories`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return [];
    }
    const body = (await response.json()) as { categories: BrowseCategoryDto[] };
    return body.categories ?? [];
  } catch {
    return [];
  }
}

async function fetchSearchResults(
  query: string,
  page: number,
  pageSize: number,
  filters: SearchFiltersDto,
  debug: boolean,
): Promise<{ data?: SearchResponseDto; error?: string }> {
  const url = new URL("/api/v1/search", SEARCH_API_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));
  if (debug) {
    url.searchParams.set("debug", "true");
  }

  for (const value of filters.brand ?? []) {
    url.searchParams.append("brand", value);
  }
  for (const value of filters.category ?? []) {
    url.searchParams.append("category", value);
  }
  for (const value of filters.inStock ?? []) {
    url.searchParams.append("inStock", value);
  }

  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return { error: `Search API returned HTTP ${response.status}` };
    }

    return { data: (await response.json()) as SearchResponseDto };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown search error",
    };
  }
}

async function recordSearchEvent(
  query: string,
  resultCount: number,
): Promise<void> {
  try {
    await fetch(`${SEARCH_API_URL}/api/v1/events/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, resultCount }),
      cache: "no-store",
    });
  } catch {
    // Analytics should not block page rendering.
  }
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = readParam(params, "query", "").trim();
  const page = parsePositiveInt(
    readParam(params, "page", String(DEFAULT_PAGE)),
    DEFAULT_PAGE,
  );
  const pageSize = parsePositiveInt(
    readParam(params, "pageSize", String(DEFAULT_PAGE_SIZE)),
    DEFAULT_PAGE_SIZE,
  );
  const activeFilters = buildActiveFilters(params);
  const debug = readParam(params, "debug", "") === "true";

  const hasQuery = query.length > 0;
  const [categories, searchResult] = await Promise.all([
    hasQuery ? Promise.resolve([]) : fetchBrowseCategories(),
    hasQuery
      ? fetchSearchResults(query, page, pageSize, activeFilters, debug)
      : Promise.resolve(null),
  ]);

  if (hasQuery && searchResult?.data) {
    await recordSearchEvent(query, searchResult.data.totalHits);
  }

  if (!hasQuery) {
    return <HomeHero categories={categories} />;
  }

  return (
    <>
      {searchResult?.data?.correctedQuery &&
        searchResult.data.correctedQuery !==
          searchResult.data.query.trim().toLowerCase() && (
          <p className="store-results-meta" style={{ marginBottom: "1rem" }}>
            Showing results for{" "}
            <strong>{searchResult.data.correctedQuery}</strong>
          </p>
        )}

      {searchResult?.error ? (
        <EmptyState mode="error" errorMessage={searchResult.error} />
      ) : null}

      {searchResult?.data ? (
        <div className="store-layout-with-sidebar">
          <Suspense fallback={<aside className="store-filters">Loading filters…</aside>}>
            <Filters
              facets={searchResult.data.availableFacets}
              activeFilters={activeFilters}
              query={query}
              pageSize={pageSize}
            />
          </Suspense>
          <SearchResults
            data={searchResult.data}
            activeFilters={activeFilters}
            debug={debug}
          />
        </div>
      ) : null}
    </>
  );
}
