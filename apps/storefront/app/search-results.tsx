import type {
  SearchFiltersDto,
  SearchResponseDto,
} from "@retailer-search/shared-types";
import { EmptyState } from "./empty-state";
import { TrackClick } from "./track-click";

interface SearchResultsProps {
  data: SearchResponseDto;
  activeFilters: SearchFiltersDto;
  debug?: boolean;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
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
    <div style={{ marginBottom: "1rem" }}>
      <p style={{ margin: "0 0 0.5rem", fontSize: 14, color: "#64748b" }}>
        Active filters
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {chips.map((chip) => (
          <span
            key={`${chip.key}-${chip.value}`}
            style={{
              fontSize: 13,
              padding: "0.25rem 0.5rem",
              borderRadius: 999,
              background: "#e2e8f0",
              color: "#334155",
            }}
          >
            {formatFilterLabel(chip.key, chip.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

function AppliedRulesSummary({ ruleNames }: { ruleNames: string[] }) {
  if (ruleNames.length === 0) {
    return null;
  }

  return (
    <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
      Merchandising rules applied: {ruleNames.join(", ")}
    </p>
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
      <ActiveFilters activeFilters={activeFilters} />
      <AppliedRulesSummary ruleNames={data.appliedRuleNames ?? []} />

      <p style={{ margin: "0 0 1rem", color: "#475569", fontSize: 14 }}>
        {data.totalHits} result{data.totalHits === 1 ? "" : "s"} for{" "}
        <strong>{data.query}</strong>
        <span style={{ marginLeft: 8, color: "#94a3b8" }}>
          ({data.processingTimeMs} ms)
        </span>
      </p>

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

            {debug && hit.rankingDebug && (
              <details style={{ marginTop: "0.75rem", fontSize: 13 }}>
                <summary style={{ cursor: "pointer", color: "#475569" }}>
                  Ranking debug (score {hit.rankingDebug.finalScore.toFixed(1)})
                </summary>
                <ul
                  style={{
                    margin: "0.5rem 0 0",
                    paddingLeft: "1.25rem",
                    color: "#64748b",
                    lineHeight: 1.6,
                  }}
                >
                  <li>Base score: {hit.rankingDebug.baseScore}</li>
                  <li>Exact match: {hit.rankingDebug.exactMatchScore}</li>
                  <li>Inventory: {hit.rankingDebug.inventoryScore.toFixed(1)}</li>
                  <li>
                    Popularity: {hit.rankingDebug.popularityScore.toFixed(1)}
                  </li>
                  <li>
                    Merchandising: {hit.rankingDebug.merchandisingAdjustment}
                  </li>
                  <li>Final score: {hit.rankingDebug.finalScore.toFixed(1)}</li>
                  {hit.rankingDebug.appliedRuleNames.length > 0 && (
                    <li>
                      Rules: {hit.rankingDebug.appliedRuleNames.join(", ")}
                    </li>
                  )}
                </ul>
              </details>
            )}

            <TrackClick
              query={data.query}
              productId={hit.id}
              productTitle={hit.title}
            >
              View product
            </TrackClick>
          </li>
        ))}
      </ul>
    </section>
  );
}
