import Link from "next/link";
import type { BrowseCategoryDto } from "@retailer-search/shared-types";

interface BrowseSidebarProps {
  categories: BrowseCategoryDto[];
  activeCategory?: string;
  pageSize: number;
  brand?: string;
  inStock?: boolean;
  sort?: string;
}

function buildBrowseUrl(options: {
  category?: string;
  pageSize: number;
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

export function BrowseSidebar({
  categories,
  activeCategory,
  pageSize,
  brand,
  inStock,
  sort,
}: BrowseSidebarProps) {
  return (
    <aside
      style={{
        padding: "1rem",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Categories</h2>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: "0.35rem",
        }}
      >
        <li>
          <Link
            href={buildBrowseUrl({ pageSize, brand, inStock, sort })}
            style={{
              fontSize: 14,
              color: !activeCategory ? "#0f172a" : "#2563eb",
              fontWeight: !activeCategory ? 600 : 400,
              textDecoration: "none",
            }}
          >
            All products
          </Link>
        </li>
        {categories.map((entry) => (
          <li key={entry.category}>
            <Link
              href={buildBrowseUrl({
                category: entry.category,
                pageSize,
                brand,
                inStock,
                sort,
              })}
              style={{
                fontSize: 14,
                color:
                  activeCategory === entry.category ? "#0f172a" : "#2563eb",
                fontWeight: activeCategory === entry.category ? 600 : 400,
                textDecoration: "none",
              }}
            >
              {entry.category}{" "}
              <span style={{ color: "#94a3b8" }}>({entry.productCount})</span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
