import Link from "next/link";
import type { SearchFiltersDto } from "@retailer-search/shared-types";

interface PaginationProps {
  page: number;
  totalPages: number;
  query: string;
  pageSize: number;
  activeFilters: SearchFiltersDto;
  debug?: boolean;
}

function buildSearchUrl(
  page: number,
  query: string,
  pageSize: number,
  activeFilters: SearchFiltersDto,
  debug?: boolean,
): string {
  const params = new URLSearchParams();
  params.set("query", query);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  for (const value of activeFilters.brand ?? []) {
    params.append("brand", value);
  }
  for (const value of activeFilters.category ?? []) {
    params.append("category", value);
  }
  for (const value of activeFilters.inStock ?? []) {
    params.append("inStock", value);
  }
  if (debug) {
    params.set("debug", "true");
  }

  return `/?${params.toString()}`;
}

export function Pagination({
  page,
  totalPages,
  query,
  pageSize,
  activeFilters,
  debug = false,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav className="store-pagination" aria-label="Search results pagination">
      {hasPrev ? (
        <Link
          href={buildSearchUrl(page - 1, query, pageSize, activeFilters, debug)}
          className="store-pagination__link"
        >
          Previous
        </Link>
      ) : (
        <span className="store-pagination__link store-pagination__link--disabled">
          Previous
        </span>
      )}

      <span className="store-pagination__status">
        Page {page} of {totalPages}
      </span>

      {hasNext ? (
        <Link
          href={buildSearchUrl(page + 1, query, pageSize, activeFilters, debug)}
          className="store-pagination__link"
        >
          Next
        </Link>
      ) : (
        <span className="store-pagination__link store-pagination__link--disabled">
          Next
        </span>
      )}
    </nav>
  );
}
