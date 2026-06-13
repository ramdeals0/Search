"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AuditLogFilterDto,
  AuditLogResponseDto,
} from "@retailer-search/shared-types";
import { AuditLogFilters } from "./audit-log-filters";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

const OUTCOME_COLORS: Record<string, string> = {
  success: "#15803d",
  failure: "#b91c1c",
};

function buildAuditLogUrl(filters: AuditLogFilterDto): string {
  const url = new URL("/api/v1/admin/audit-logs", SEARCH_API_URL);

  if (filters.actionType) {
    url.searchParams.set("actionType", filters.actionType);
  }
  if (filters.entityType) {
    url.searchParams.set("entityType", filters.entityType);
  }
  if (filters.outcome) {
    url.searchParams.set("outcome", filters.outcome);
  }
  if (filters.actorId) {
    url.searchParams.set("actorId", filters.actorId);
  }
  if (filters.keyword) {
    url.searchParams.set("keyword", filters.keyword);
  }

  return url.toString();
}

export function AuditLogPanel() {
  const [filters, setFilters] = useState<AuditLogFilterDto>({});
  const [data, setData] = useState<AuditLogResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async (activeFilters: AuditLogFilterDto) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(buildAuditLogUrl(activeFilters), {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to load audit logs: HTTP ${response.status}`);
      }

      setData((await response.json()) as AuditLogResponseDto);
    } catch (loadError) {
      setData(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load audit logs",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs(filters);
  }, [filters, loadLogs]);

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
          alignItems: "baseline",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Audit log</h2>
        {data && (
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            {data.total} entr{data.total === 1 ? "y" : "ies"}
          </span>
        )}
      </div>

      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Append-only history of admin actions. Newest entries appear first.
      </p>

      <AuditLogFilters filters={filters} onChange={setFilters} />

      {loading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Loading audit log...
        </p>
      )}

      {error && (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p>
      )}

      {!loading && !error && data?.entries.length === 0 && (
        <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
          No audit entries yet. Create a rule, apply a suggestion, or run a query
          preview to generate history.
        </p>
      )}

      {!loading && !error && data && data.entries.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: "0.65rem",
          }}
        >
          {data.entries.map((entry) => (
            <li
              key={entry.id}
              style={{
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  alignItems: "center",
                  marginBottom: "0.35rem",
                }}
              >
                <strong style={{ color: "var(--forge-primary)" }}>{entry.summary}</strong>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: OUTCOME_COLORS[entry.outcome],
                    textTransform: "uppercase",
                  }}
                >
                  {entry.outcome}
                </span>
              </div>

              <div style={{ color: "#64748b", marginBottom: "0.35rem" }}>
                {new Date(entry.timestamp).toLocaleString()} · {entry.actorLabel}{" "}
                · {entry.actionType} · {entry.entityType}
                {entry.entityLabel ? ` · ${entry.entityLabel}` : ""}
              </div>

              {entry.metadata && (
                <details>
                  <summary style={{ cursor: "pointer", color: "#475569" }}>
                    Metadata
                  </summary>
                  <pre
                    style={{
                      margin: "0.5rem 0 0",
                      padding: "0.65rem",
                      borderRadius: 6,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      fontSize: 11,
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
