"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useCallback, useState } from "react";
import type {
  CatalogAnalyticsInsightsDto,
  QueryPreviewResponseDto,
} from "@retailer-search/shared-types";

import { RankingScoreBreakdown } from "./ranking-score-breakdown";

interface ProductsWorkspaceProps {
  insights: CatalogAnalyticsInsightsDto;
  productCount: number;
  catalogSource?: "database" | "generated-json" | "empty";
}

function metricLabel(source: string): string {
  switch (source) {
    case "clicks":
      return "clicks";
    case "searches":
      return "searches";
    case "popularity":
      return "popularity";
    default:
      return "count";
  }
}

export function ProductsWorkspace({
  insights,
  productCount,
  catalogSource = "empty",
}: ProductsWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<QueryPreviewResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runPreview = useCallback(async (nextQuery?: string) => {
    const trimmed = (nextQuery ?? query).trim();
    if (!trimmed) {
      return;
    }

    setQuery(trimmed);
    setLoading(true);
    setError(null);

    try {
      const url = new URL("/api/v1/admin/query-preview", getSearchApiUrl());
      url.searchParams.set("query", trimmed);
      url.searchParams.set("pageSize", "10");

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Preview failed with HTTP ${response.status}`);
      }

      setPreview((await response.json()) as QueryPreviewResponseDto);
    } catch (previewError) {
      setPreview(null);
      setError(
        previewError instanceof Error ? previewError.message : "Preview failed",
      );
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div className="forge-page-stack--loose">
      {productCount === 0 ? (
        <div className="forge-callout forge-callout--dashed">
          Product catalog is empty. From the repo root run{" "}
          <code>pnpm prisma:seed</code>, then restart search-api. Until then, search
          previews cannot return products.
        </div>
      ) : catalogSource === "generated-json" ? (
        <div className="forge-callout forge-callout--info">
          Loaded {productCount.toLocaleString()} products from generated catalog fallback.
          Run <code>pnpm prisma:seed</code> to persist the catalog in PostgreSQL.
        </div>
      ) : null}

      <section className="forge-card forge-card--panel">
        <h2 className="forge-section-title" style={{ marginTop: 0 }}>
          Search catalog
        </h2>
        <p style={{ margin: "0 0 1rem", fontSize: 14, color: "var(--forge-text-muted)" }}>
          Preview how products rank for a shopper query. Results appear below before
          catalog insights.
        </p>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: preview ? "1rem" : 0 }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void runPreview();
              }
            }}
            placeholder="e.g. cordless drill, gfci outlet, mulch"
            className="forge-input"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => void runPreview()}
            disabled={loading}
            className="forge-btn forge-btn--primary"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {error ? (
          <p style={{ margin: "0.75rem 0 0", color: "var(--forge-error)", fontSize: 14 }}>
            {error}
          </p>
        ) : null}

        {preview ? (
          <div
            style={{
              marginTop: "1rem",
              paddingTop: "1rem",
              borderTop: "1px solid var(--forge-border)",
            }}
          >
            <p style={{ margin: "0 0 0.75rem", fontSize: 14, color: "var(--forge-text-muted)" }}>
              {preview.total} result{preview.total === 1 ? "" : "s"} for{" "}
              <strong style={{ color: "var(--forge-text)" }}>{preview.query}</strong>
            </p>
            {preview.total === 0 ? (
              <p style={{ margin: "0 0 0.75rem", fontSize: 14, color: "var(--forge-text-subtle)" }}>
                No matching products. Try <strong>cordless drill</strong>,{" "}
                <strong>gfci outlet</strong>, or <strong>mulch</strong>.
                {productCount === 0
                  ? " The catalog may not be loaded yet — see the notice above."
                  : null}
              </p>
            ) : null}
            {preview.appliedRuleNames.length > 0 ? (
              <p style={{ margin: "0 0 0.75rem", fontSize: 13, color: "var(--forge-text-subtle)" }}>
                Applied rules: {preview.appliedRuleNames.join(", ")}
              </p>
            ) : null}
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: "0.5rem",
              }}
            >
              {preview.hits.map((hit, index) => (
                <li
                  key={hit.id}
                  style={{
                    padding: "0.75rem 0.875rem",
                    border: "1px solid var(--forge-border)",
                    borderRadius: "var(--forge-radius-sm)",
                    background: "var(--forge-surface-muted)",
                    fontSize: 14,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                    <div>
                      <strong>{hit.title}</strong>
                      <div style={{ fontSize: 13, color: "var(--forge-text-subtle)", marginTop: 2 }}>
                        {hit.brand} · {hit.category}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--forge-text-muted)",
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}
                    >
                      score {hit.score.toFixed(1)}
                    </span>
                  </div>
                  {hit.rankingDebug ? (
                    <RankingScoreBreakdown
                      rankingDebug={hit.rankingDebug}
                      rank={index + 1}
                      compact
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))",
          gap: "1rem",
        }}
      >
        <InsightCard
          title="Top searched products"
          subtitle="Ranked by storefront clicks, or catalog popularity before traffic exists."
          emptyLabel="No product signals yet."
          items={insights.topProducts.map((item) => ({
            key: item.productId,
            primary: item.title,
            secondary: `${item.brand} · ${item.category}`,
            count: item.count,
            metric: metricLabel(item.source),
            onSelect: () => void runPreview(item.title),
          }))}
        />

        <InsightCard
          title="Top searched brands"
          subtitle="Brands with the most click or query volume."
          emptyLabel="No brand signals yet."
          items={insights.topBrands.map((item) => ({
            key: item.brand,
            primary: item.brand,
            secondary: "Brand query volume",
            count: item.count,
            metric: metricLabel(item.source),
            onSelect: () => void runPreview(item.brand),
          }))}
        />

        <InsightCard
          title="Top searched queries"
          subtitle="Most frequent shopper searches recorded by the API."
          emptyLabel="Run storefront searches to populate query data."
          items={insights.topQueries.map((item) => ({
            key: item.query,
            primary: item.query,
            secondary: "Search query",
            count: item.count,
            metric: "searches",
            onSelect: () => void runPreview(item.query),
          }))}
        />

        <InsightCard
          title="Top searched categories"
          subtitle="Departments with the strongest click or query activity."
          emptyLabel="No category signals yet."
          items={insights.topCategories.map((item) => ({
            key: item.category,
            primary: item.category,
            secondary: "Department interest",
            count: item.count,
            metric: metricLabel(item.source),
            onSelect: () => void runPreview(item.category),
          }))}
        />
      </div>
    </div>
  );
}

function InsightCard(props: {
  title: string;
  subtitle: string;
  emptyLabel: string;
  items: Array<{
    key: string;
    primary: string;
    secondary: string;
    count: number;
    metric: string;
    onSelect: () => void;
  }>;
}) {
  return (
    <section className="forge-card forge-card--panel" style={{ display: "flex", flexDirection: "column" }}>
      <h2 className="forge-section-title" style={{ marginTop: 0 }}>
        {props.title}
      </h2>
      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "var(--forge-text-subtle)" }}>
        {props.subtitle}
      </p>

      {props.items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--forge-text-subtle)" }}>
          {props.emptyLabel}
        </p>
      ) : (
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: "0.5rem",
          }}
        >
          {props.items.map((item, index) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={item.onSelect}
                className="forge-quick-link"
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "1px solid var(--forge-border)",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--forge-accent)", fontWeight: 600 }}>
                      #{index + 1}
                    </div>
                    <div className="forge-quick-link__title">{item.primary}</div>
                    <div className="forge-quick-link__hint">{item.secondary}</div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--forge-text-muted)",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.count} {item.metric}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
