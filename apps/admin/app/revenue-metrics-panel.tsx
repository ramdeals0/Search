"use client";

import { useCallback, useEffect, useState } from "react";
import type { RevenueMetricsDto } from "@retailer-search/shared-types";
import { getSearchApiUrl } from "./lib/search-api-url";

const panelStyle = {
  padding: "1rem",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#fff",
} as const;

const inputStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
} as const;

const metricCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "0.75rem",
  background: "#f8fafc",
} as const;

const DAY_OPTIONS = [7, 30, 90] as const;
type DayOption = (typeof DAY_OPTIONS)[number];

const EMPTY_METRICS: RevenueMetricsDto = {
  windowDays: 30,
  purchaseCount: 0,
  addToCartCount: 0,
  revenueCents: 0,
  revenuePerSearch: 0,
  searchesInWindow: 0,
};

export function RevenueMetricsPanel() {
  const [days, setDays] = useState<DayOption>(30);
  const [metrics, setMetrics] = useState<RevenueMetricsDto>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/analytics/revenue?days=${days}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(`Failed to load revenue metrics (${response.status})`);
      }
      setMetrics((await response.json()) as RevenueMetricsDto);
    } catch (loadError) {
      setMetrics({ ...EMPTY_METRICS, windowDays: days });
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load revenue metrics",
      );
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const revenueDollars = (metrics.revenueCents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "0.85rem",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.1rem" }}>Revenue metrics</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Conversion and revenue performance from commerce events.
          </p>
        </div>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Window
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value) as DayOption)}
            style={inputStyle}
            disabled={loading}
          >
            {DAY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Last {option} days
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 14 }}>{error}</p>
      ) : null}

      {loading ? (
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Loading revenue metrics...</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <article style={metricCardStyle}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Revenue</div>
            <strong style={{ fontSize: 18 }}>{revenueDollars}</strong>
          </article>
          <article style={metricCardStyle}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Purchases</div>
            <strong style={{ fontSize: 18 }}>{metrics.purchaseCount.toLocaleString()}</strong>
          </article>
          <article style={metricCardStyle}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Add to cart</div>
            <strong style={{ fontSize: 18 }}>{metrics.addToCartCount.toLocaleString()}</strong>
          </article>
          <article style={metricCardStyle}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Searches</div>
            <strong style={{ fontSize: 18 }}>{metrics.searchesInWindow.toLocaleString()}</strong>
          </article>
          <article style={metricCardStyle}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
              Revenue / search
            </div>
            <strong style={{ fontSize: 18 }}>{metrics.revenuePerSearch.toFixed(4)}</strong>
          </article>
        </div>
      )}
    </section>
  );
}
