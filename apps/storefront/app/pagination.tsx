import Link from "next/link";
import type { CSSProperties } from "react";
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

const linkStyle: CSSProperties = {
  padding: "0.5rem 0.85rem",
  fontSize: 14,
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 500,
};

const disabledStyle: CSSProperties = {
  ...linkStyle,
  color: "#94a3b8",
  background: "#f8fafc",
  borderColor: "#e2e8f0",
  cursor: "not-allowed",
};

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
    <nav
      aria-label="Search results pagination"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        marginTop: "1.25rem",
        paddingTop: "1rem",
        borderTop: "1px solid #e2e8f0",
      }}
    >
      {hasPrev ? (
        <Link
          href={buildSearchUrl(page - 1, query, pageSize, activeFilters, debug)}
          style={linkStyle}
        >
          Previous
        </Link>
      ) : (
        <span style={disabledStyle} aria-disabled="true">
          Previous
        </span>
      )}

      <span style={{ fontSize: 14, color: "#475569" }}>
        Page {page} of {totalPages}
      </span>

      {hasNext ? (
        <Link
          href={buildSearchUrl(page + 1, query, pageSize, activeFilters, debug)}
          style={linkStyle}
        >
          Next
        </Link>
      ) : (
        <span style={disabledStyle} aria-disabled="true">
          Next
        </span>
      )}
    </nav>
  );
}
