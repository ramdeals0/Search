"use client";

import type { RankingDebugDto } from "@retailer-search/shared-types";

interface RankingScoreBreakdownProps {
  rankingDebug: RankingDebugDto;
  rank?: number;
  compact?: boolean;
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatSigned(value: number): string {
  if (value === 0) {
    return "0";
  }
  const formatted = formatScore(Math.abs(value));
  return value > 0 ? `+${formatted}` : `−${formatted}`;
}

export function RankingScoreBreakdown({
  rankingDebug,
  rank,
  compact = false,
}: RankingScoreBreakdownProps) {
  const components = [
    {
      label: "Base relevance",
      hint: "Keyword matches in title, brand, category, and searchable text",
      value: rankingDebug.baseScore,
    },
    {
      label: "Exact match",
      hint: "Bonus for title/brand/category alignment with the query",
      value: rankingDebug.exactMatchScore,
    },
    {
      label: "Inventory",
      hint: "In-stock products with higher inventory score higher (max 8)",
      value: rankingDebug.inventoryScore,
    },
    {
      label: "Popularity",
      hint: "Catalog popularity signal from inventory depth (max 10)",
      value: rankingDebug.popularityScore,
    },
    {
      label: "Merchandising",
      hint: "Boost, bury, and hide rules applied to this product",
      value: rankingDebug.merchandisingAdjustment,
    },
  ];

  const subtotal = components.reduce((sum, item) => sum + item.value, 0);

  return (
    <details
      style={{
        marginTop: compact ? "0.5rem" : "0.75rem",
        fontSize: 13,
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          color: "var(--forge-text-muted, #475569)",
          fontWeight: 600,
        }}
      >
        {rank !== undefined ? `#${rank} · ` : ""}
        Score breakdown ({formatScore(rankingDebug.finalScore)})
      </summary>

      <div
        style={{
          marginTop: "0.65rem",
          padding: "0.75rem",
          border: "1px solid var(--forge-border, #e2e8f0)",
          borderRadius: "var(--forge-radius-sm, 6px)",
          background: "var(--forge-surface-muted, #f8fafc)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", color: "var(--forge-text-subtle, #64748b)" }}>
              <th style={{ padding: "0 0 0.35rem", fontWeight: 600 }}>Component</th>
              <th
                style={{
                  padding: "0 0 0.35rem",
                  fontWeight: 600,
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {components.map((item) => (
              <tr key={item.label}>
                <td style={{ padding: "0.3rem 0.5rem 0.3rem 0", verticalAlign: "top" }}>
                  <div style={{ color: "var(--forge-text)" }}>{item.label}</div>
                  {!compact ? (
                    <div style={{ fontSize: 12, color: "var(--forge-text-subtle, #64748b)" }}>
                      {item.hint}
                    </div>
                  ) : null}
                </td>
                <td
                  style={{
                    padding: "0.3rem 0",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                    color:
                      item.value > 0
                        ? "#15803d"
                        : item.value < 0
                          ? "#b91c1c"
                          : "var(--forge-text-muted, #475569)",
                  }}
                >
                  {formatSigned(item.value)}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: "1px solid var(--forge-border, #e2e8f0)" }}>
              <td style={{ padding: "0.5rem 0.5rem 0 0", fontWeight: 600 }}>Final score</td>
              <td
                style={{
                  padding: "0.5rem 0 0",
                  textAlign: "right",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatScore(rankingDebug.finalScore)}
              </td>
            </tr>
          </tbody>
        </table>

        <p
          style={{
            margin: "0.65rem 0 0",
            fontSize: 12,
            color: "var(--forge-text-subtle, #64748b)",
            lineHeight: 1.5,
          }}
        >
          Final score = base + exact match + inventory + popularity + merchandising
          {Math.abs(subtotal - rankingDebug.finalScore) > 0.01
            ? ` (${formatScore(subtotal)} computed)`
            : ""}
          . Pin rules reorder results without changing these points.
        </p>

        {rankingDebug.appliedRuleNames.length > 0 ? (
          <p style={{ margin: "0.35rem 0 0", fontSize: 12, color: "var(--forge-text-subtle, #64748b)" }}>
            Rules for this product:{" "}
            <strong style={{ color: "var(--forge-text)" }}>
              {rankingDebug.appliedRuleNames.join(", ")}
            </strong>
          </p>
        ) : null}
      </div>
    </details>
  );
}
