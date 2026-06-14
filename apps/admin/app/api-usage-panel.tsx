"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiUsageSummaryDto } from "@retailer-search/shared-types";
import { getAuthHeaders } from "./lib/auth-headers";
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

const buttonStyle = {
  padding: "0.45rem 0.75rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
} as const;

export function ApiUsagePanel() {
  const [days, setDays] = useState("7");
  const [summary, setSummary] = useState<ApiUsageSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsage = useCallback(async () => {
    setLoading(true);
    setError(null);

    const parsedDays = Number.parseInt(days, 10) || 7;

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/api-usage?days=${parsedDays}`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: getAuthHeaders("none"),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to load API usage (${response.status})`);
      }
      setSummary((await response.json()) as ApiUsageSummaryDto);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load usage");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  return (
    <section style={panelStyle}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>API usage</h2>
      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Request volume by route and API key over the selected window.
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "end",
          marginBottom: "1rem",
        }}
      >
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Days
          <input
            value={days}
            onChange={(event) => setDays(event.target.value)}
            style={{ ...inputStyle, width: 80 }}
            min={1}
            max={90}
          />
        </label>
        <button type="button" style={buttonStyle} onClick={() => void loadUsage()}>
          Refresh
        </button>
      </div>

      {error ? (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 14 }}>{error}</p>
      ) : null}

      {loading ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Loading usage...</p>
      ) : summary ? (
        <>
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.85rem",
              borderRadius: 8,
              background: "var(--forge-accent-subtle)",
              border: "1px solid var(--forge-accent-border)",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--forge-text-muted)" }}>Total requests</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--forge-text)" }}>
              {summary.totalRequests.toLocaleString()}
            </div>
          </div>

          {summary.meters.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>No usage recorded yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "0.5rem" }}>Route</th>
                    <th style={{ padding: "0.5rem" }}>API key</th>
                    <th style={{ padding: "0.5rem" }}>Tenant</th>
                    <th style={{ padding: "0.5rem" }}>Window start</th>
                    <th style={{ padding: "0.5rem" }}>Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.meters.map((meter, index) => (
                    <tr
                      key={`${meter.apiKeyId}-${meter.route}-${meter.windowStart}-${index}`}
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                    >
                      <td style={{ padding: "0.5rem" }}>
                        <code>{meter.route}</code>
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <code>{meter.apiKeyId.slice(0, 8)}…</code>
                      </td>
                      <td style={{ padding: "0.5rem" }}>{meter.tenantId}</td>
                      <td style={{ padding: "0.5rem", fontSize: 12 }}>
                        {new Date(meter.windowStart).toLocaleString()}
                      </td>
                      <td style={{ padding: "0.5rem", fontWeight: 600 }}>
                        {meter.requestCount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
