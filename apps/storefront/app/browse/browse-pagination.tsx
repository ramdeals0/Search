import Link from "next/link";

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
    <nav className="store-pagination" aria-label="Browse pagination">
      {hasPrev ? (
        <Link
          href={buildBrowseUrl(page - 1, pageSize, category, brand, inStock, sort)}
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
          href={buildBrowseUrl(page + 1, pageSize, category, brand, inStock, sort)}
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
