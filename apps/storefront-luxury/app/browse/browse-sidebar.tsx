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
    <aside className="store-sidebar">
      <h2 className="store-sidebar__title">Departments</h2>
      <ul className="store-sidebar__list">
        <li>
          <Link
            href={buildBrowseUrl({ pageSize, brand, inStock, sort })}
            className={`store-sidebar__link${!activeCategory ? " store-sidebar__link--active" : ""}`}
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
              className={`store-sidebar__link${activeCategory === entry.category ? " store-sidebar__link--active" : ""}`}
            >
              {entry.category}{" "}
              <span style={{ color: "var(--store-muted)" }}>({entry.productCount})</span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
