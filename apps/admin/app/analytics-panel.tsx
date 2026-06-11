import type { SearchAnalyticsSummaryDto } from "@retailer-search/shared-types";

interface AnalyticsPanelProps {
  analytics: SearchAnalyticsSummaryDto;
}

export function AnalyticsPanel({ analytics }: AnalyticsPanelProps) {
  return (
    <section
      style={{
        padding: "1rem",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>
        Search analytics
      </h2>

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
              No search data yet
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
              No zero-result queries yet
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
