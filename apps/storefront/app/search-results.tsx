import type {
  SearchFiltersDto,
  SearchResponseDto,
} from "@retailer-search/shared-types";
import { ProductCard } from "./components/product-card";
import { EmptyState } from "./empty-state";
import { Pagination } from "./pagination";

interface SearchResultsProps {
  data: SearchResponseDto;
  activeFilters: SearchFiltersDto;
  debug?: boolean;
}

function formatFilterLabel(key: string, value: string): string {
  if (key === "inStock") {
    return value === "true" ? "In stock" : "Out of stock";
  }
  return value;
}

function ActiveFilters({ activeFilters }: { activeFilters: SearchFiltersDto }) {
  const chips: Array<{ key: string; value: string }> = [];

  for (const [key, values] of Object.entries(activeFilters)) {
    for (const value of values ?? []) {
      chips.push({ key, value });
    }
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="store-filter-chips">
      {chips.map((chip) => (
        <span key={`${chip.key}-${chip.value}`} className="store-filter-chip">
          {formatFilterLabel(chip.key, chip.value)}
        </span>
      ))}
    </div>
  );
}

export function SearchResults({
  data,
  activeFilters,
  debug = false,
}: SearchResultsProps) {
  if (data.hits.length === 0) {
    return <EmptyState mode="no-results" query={data.query} />;
  }

  return (
    <section>
      <div className="store-results-header">
        <p className="store-results-meta">
          {data.totalHits} result{data.totalHits === 1 ? "" : "s"} for{" "}
          <strong>{data.query}</strong>
        </p>
        {debug ? (
          <span className="store-results-meta">{data.processingTimeMs} ms</span>
        ) : null}
      </div>

      <ActiveFilters activeFilters={activeFilters} />

      {(data.appliedRuleNames?.length ?? 0) > 0 && (
        <p className="store-results-meta" style={{ marginBottom: "1rem" }}>
          Promotions applied: {data.appliedRuleNames?.join(", ")}
        </p>
      )}

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
              query={data.query}
            />
            {debug && hit.rankingDebug ? (
              <details style={{ marginTop: "0.5rem", fontSize: 12 }}>
                <summary>Ranking debug</summary>
                <pre style={{ overflow: "auto", fontSize: 11 }}>
                  {JSON.stringify(hit.rankingDebug, null, 2)}
                </pre>
              </details>
            ) : null}
          </li>
        ))}
      </ul>

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        query={data.query}
        pageSize={data.pageSize}
        activeFilters={activeFilters}
        debug={debug}
      />
    </section>
  );
}
