import type { BrowseResponseDto } from "@retailer-search/shared-types";
import { BrowsePagination } from "./browse-pagination";

interface BrowseResultsProps {
  data: BrowseResponseDto;
  category?: string;
  brand?: string;
  inStock?: boolean;
  sort?: string;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export function BrowseResults({
  data,
  category,
  brand,
  inStock,
  sort,
}: BrowseResultsProps) {
  const heading = category ? category : "All products";

  return (
    <section>
      <p style={{ margin: "0 0 1rem", color: "#475569", fontSize: 14 }}>
        {data.totalHits} product{data.totalHits === 1 ? "" : "s"}
        {category ? (
          <>
            {" "}
            in <strong>{heading}</strong>
          </>
        ) : null}
        <span style={{ marginLeft: 8, color: "#94a3b8" }}>
          ({data.processingTimeMs} ms)
        </span>
      </p>

      {data.hits.length === 0 ? (
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
          No products match your filters.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: "0.75rem",
          }}
        >
          {data.hits.map((hit) => (
            <li
              key={hit.id}
              style={{
                padding: "1rem",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 0.35rem", fontSize: "1rem" }}>
                    {hit.title}
                  </h3>
                  <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                    {hit.brand} · {hit.category} · {hit.subcategory}
                  </p>
                </div>
                <strong style={{ fontSize: "1rem", whiteSpace: "nowrap" }}>
                  {formatPrice(hit.price)}
                </strong>
              </div>
              <p
                style={{
                  margin: "0.5rem 0 0",
                  fontSize: 14,
                  color: hit.inStock ? "#15803d" : "#b91c1c",
                }}
              >
                {hit.inStock ? "In stock" : "Out of stock"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <BrowsePagination
        page={data.page}
        totalPages={data.totalPages}
        pageSize={data.pageSize}
        category={category}
        brand={brand}
        inStock={inStock}
        sort={sort}
      />
    </section>
  );
}
