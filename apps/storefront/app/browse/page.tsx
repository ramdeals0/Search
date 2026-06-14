import Link from "next/link";
import type {
  BrowseCategoryDto,
  BrowseResponseDto,
} from "@retailer-search/shared-types";
import { BrowseResults } from "./browse-results";
import { BrowseSidebar } from "./browse-sidebar";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export const metadata = {
  title: "Shop all products",
};

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

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseInStock(value: string): boolean | undefined {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

async function fetchBrowseCategories(): Promise<{
  categories: BrowseCategoryDto[];
  error?: string;
}> {
  try {
    const response = await fetch(`${SEARCH_API_URL}/api/v1/browse/categories`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return { categories: [], error: `Browse API returned HTTP ${response.status}` };
    }

    const body = (await response.json()) as { categories: BrowseCategoryDto[] };
    return { categories: body.categories };
  } catch (error) {
    return {
      categories: [],
      error: error instanceof Error ? error.message : "Unknown browse error",
    };
  }
}

async function fetchBrowseResults(options: {
  page: number;
  pageSize: number;
  category?: string;
  brand?: string;
  inStock?: boolean;
  sort?: string;
}): Promise<{ data?: BrowseResponseDto; error?: string }> {
  const url = new URL("/api/v1/browse", SEARCH_API_URL);
  url.searchParams.set("page", String(options.page));
  url.searchParams.set("pageSize", String(options.pageSize));
  if (options.category) {
    url.searchParams.set("category", options.category);
  }
  if (options.brand) {
    url.searchParams.set("brand", options.brand);
  }
  if (options.inStock !== undefined) {
    url.searchParams.set("inStock", String(options.inStock));
  }
  if (options.sort) {
    url.searchParams.set("sort", options.sort);
  }

  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return { error: `Browse API returned HTTP ${response.status}` };
    }

    return { data: (await response.json()) as BrowseResponseDto };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown browse error",
    };
  }
}

function buildBrowseUrl(options: {
  pageSize: number;
  category?: string;
  brand?: string;
  inStock?: boolean;
  sort?: string;
}): string {
  const params = new URLSearchParams();
  params.set("page", "1");
  params.set("pageSize", String(options.pageSize));
  if (options.category) {
    params.set("category", options.category);
  }
  if (options.brand) {
    params.set("brand", options.brand);
  }
  if (options.inStock !== undefined) {
    params.set("inStock", String(options.inStock));
  }
  if (options.sort) {
    params.set("sort", options.sort);
  }
  return `/browse?${params.toString()}`;
}

export default async function BrowsePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parsePositiveInt(
    readParam(params, "page", String(DEFAULT_PAGE)),
    DEFAULT_PAGE,
  );
  const pageSize = parsePositiveInt(
    readParam(params, "pageSize", String(DEFAULT_PAGE_SIZE)),
    DEFAULT_PAGE_SIZE,
  );
  const category = readParam(params, "category", "").trim() || undefined;
  const brand = readParam(params, "brand", "").trim() || undefined;
  const inStock = parseInStock(readParam(params, "inStock", ""));
  const sort = readParam(params, "sort", "relevance").trim() || "relevance";

  const [categoriesResult, browseResult] = await Promise.all([
    fetchBrowseCategories(),
    fetchBrowseResults({
      page,
      pageSize,
      category,
      brand,
      inStock,
      sort,
    }),
  ]);

  const error = categoriesResult.error ?? browseResult.error;
  const pageTitle = category ?? "Shop all products";

  return (
    <>
      <div className="store-results-header" style={{ marginBottom: "1.25rem" }}>
        <div>
          <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.75rem" }}>{pageTitle}</h1>
          <p className="store-results-meta" style={{ margin: 0 }}>
            Browse our full catalog with filters and sorting.
          </p>
        </div>
        <Link href="/" className="store-btn store-btn--secondary">
          Back to home
        </Link>
      </div>

      <form method="get" action="/browse" className="store-browse-toolbar">
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={String(pageSize)} />

        <label>
          Brand
          <input
            name="brand"
            defaultValue={brand ?? ""}
            placeholder="Filter by brand"
            className="store-input"
          />
        </label>

        <label>
          Stock
          <select
            name="inStock"
            defaultValue={
              inStock === undefined ? "" : inStock ? "true" : "false"
            }
            className="store-select"
          >
            <option value="">Any</option>
            <option value="true">In stock</option>
            <option value="false">Out of stock</option>
          </select>
        </label>

        <label>
          Sort
          <select name="sort" defaultValue={sort} className="store-select">
            <option value="relevance">Relevance</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="title_asc">Title A–Z</option>
          </select>
        </label>

        <button type="submit" className="store-btn store-btn--primary">
          Apply
        </button>

        {brand || inStock !== undefined || sort !== "relevance" ? (
          <Link
            href={buildBrowseUrl({ pageSize, category, sort: "relevance" })}
            className="store-results-meta"
            style={{ alignSelf: "center", textDecoration: "none" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {error ? (
        <div className="store-empty store-empty--error">
          <p className="store-empty__text">{error}</p>
        </div>
      ) : null}

      {!error && browseResult.data ? (
        <div className="store-layout-with-sidebar">
          <BrowseSidebar
            categories={categoriesResult.categories}
            activeCategory={category}
            pageSize={pageSize}
            brand={brand}
            inStock={inStock}
            sort={sort}
          />
          <BrowseResults
            data={browseResult.data}
            category={category}
            brand={brand}
            inStock={inStock}
            sort={sort}
          />
        </div>
      ) : null}
    </>
  );
}
