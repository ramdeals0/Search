import Link from "next/link";
import type { CSSProperties } from "react";

interface BrowsePaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  category?: string;
  brand?: string;
  inStock?: boolean;
  sort?: string;
}

function buildBrowseUrl(
  page: number,
  pageSize: number,
  category?: string,
  brand?: string,
  inStock?: boolean,
  sort?: string,
): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (category) {
    params.set("category", category);
  }
  if (brand) {
    params.set("brand", brand);
  }
  if (inStock !== undefined) {
    params.set("inStock", String(inStock));
  }
  if (sort) {
    params.set("sort", sort);
  }
  return `/browse?${params.toString()}`;
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

export function BrowsePagination({
  page,
  totalPages,
  pageSize,
  category,
  brand,
  inStock,
  sort,
}: BrowsePaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav
      aria-label="Browse pagination"
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
          href={buildBrowseUrl(page - 1, pageSize, category, brand, inStock, sort)}
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
          href={buildBrowseUrl(page + 1, pageSize, category, brand, inStock, sort)}
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
