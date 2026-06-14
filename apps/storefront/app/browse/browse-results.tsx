import type { BrowseResponseDto } from "@retailer-search/shared-types";
import { ProductCard } from "../components/product-card";
import { BrowsePagination } from "./browse-pagination";

interface BrowseResultsProps {
  data: BrowseResponseDto;
  category?: string;
  brand?: string;
  inStock?: boolean;
  sort?: string;
}

export function BrowseResults({
  data,
  category,
  brand,
  inStock,
  sort,
}: BrowseResultsProps) {
  const heading = category ?? "All products";

  return (
    <section>
      <div className="store-results-header">
        <p className="store-results-meta">
          {data.totalHits} product{data.totalHits === 1 ? "" : "s"}
          {category ? (
            <>
              {" "}
              in <strong>{heading}</strong>
            </>
          ) : null}
        </p>
      </div>

      {data.hits.length === 0 ? (
        <div className="store-empty">
          <h2 className="store-empty__title">No products match</h2>
          <p className="store-empty__text">
            Try clearing filters or choosing another category.
          </p>
        </div>
      ) : (
        <ul className="store-product-grid">
          {data.hits.map((hit) => (
            <li key={hit.id}>
              <ProductCard
                id={hit.id}
                title={hit.title}
                brand={hit.brand}
                category={hit.category}
                subcategory={hit.subcategory}
                price={hit.price}
                inStock={hit.inStock}
                imageUrl={hit.imageUrl}
              />
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
