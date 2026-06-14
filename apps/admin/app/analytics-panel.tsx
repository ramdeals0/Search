"use client";

import { useCallback, useEffect, useState } from "react";
import type { SearchAnalyticsSummaryDto } from "@retailer-search/shared-types";
import { getSearchApiUrl } from "./lib/search-api-url";

const EMPTY_ANALYTICS: SearchAnalyticsSummaryDto = {
  totalSearches: 0,
  totalClicks: 0,
  topQueries: [],
  noResultQueries: [],
};

const REFRESH_INTERVAL_MS = 20_000;

export function AnalyticsPanel() {
  const [analytics, setAnalytics] = useState<SearchAnalyticsSummaryDto>(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/analytics/summary`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`Failed to load analytics: HTTP ${response.status}`);
      }

      setAnalytics((await response.json()) as SearchAnalyticsSummaryDto);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load analytics",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();

    const intervalId = window.setInterval(() => {
      void loadAnalytics();
    }, REFRESH_INTERVAL_MS);

    const handleFocus = () => {
      void loadAnalytics();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadAnalytics]);

  return (
    <section
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
          gap: "0.75rem",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Search analytics</h2>
        <button
          type="button"
          onClick={() => void loadAnalytics()}
          disabled={loading}
          style={{
            padding: "0.35rem 0.65rem",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            background: "#fff",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 13 }}>{error}</p>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Total searches
          </p>
          <strong style={{ fontSize: 24 }}>{analytics.totalSearches}</strong>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Total clicks
          </p>
          <strong style={{ fontSize: 24 }}>{analytics.totalClicks}</strong>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: 14 }}>Top queries</h3>
          {analytics.topQueries.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
              {loading ? "Loading search data..." : "No search data yet"}
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: 13 }}>
              {analytics.topQueries.map((item) => (
                <li key={item.query}>
                  {item.query} ({item.count})
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: 14 }}>
            No-result queries
          </h3>
          {analytics.noResultQueries.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
              {loading
                ? "Loading zero-result data..."
                : "No zero-result queries yet"}
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: 13 }}>
              {analytics.noResultQueries.map((item) => (
                <li key={item.query}>
                  {item.query} ({item.count})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
