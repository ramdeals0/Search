"use client";

import { useState } from "react";
import type { EnvironmentKey, RuleConflictReportDto } from "@retailer-search/shared-types";
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
  width: "100%",
} as const;

const buttonStyle = {
  padding: "0.55rem 0.9rem",
  border: "none",
  borderRadius: 6,
  background: "var(--forge-primary)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 14,
} as const;

const EMPTY_REPORT: RuleConflictReportDto = {
  query: "",
  environment: "staging",
  conflicts: [],
};

export function RuleConflictsPanel() {
  const [query, setQuery] = useState("");
  const [environment, setEnvironment] = useState<EnvironmentKey>("staging");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RuleConflictReportDto>(EMPTY_REPORT);

  const inspectConflicts = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    setReport(EMPTY_REPORT);

    try {
      const params = new URLSearchParams({
        query: query.trim(),
        environment,
      });
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/merchandising/conflicts?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(`Conflict report failed (${response.status})`);
      }
      setReport((await response.json()) as RuleConflictReportDto);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to inspect conflicts",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={panelStyle}>
      <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.1rem" }}>Rule conflicts</h2>
      <p style={{ margin: "0 0 0.85rem", fontSize: 13, color: "#64748b" }}>
        Check where active rules overlap for the same query and environment.
      </p>

      <form
        onSubmit={(event) => void inspectConflicts(event)}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto",
          gap: "0.65rem",
          alignItems: "end",
          marginBottom: "1rem",
        }}
      >
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Query
          <input
            style={inputStyle}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="running shoes"
            required
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Environment
          <select
            value={environment}
            onChange={(event) => setEnvironment(event.target.value as EnvironmentKey)}
            style={{ ...inputStyle, width: 130 }}
          >
            <option value="staging">Staging</option>
            <option value="live">Live</option>
          </select>
        </label>
        <button type="submit" style={buttonStyle} disabled={loading || !query.trim()}>
          {loading ? "Checking..." : "Inspect"}
        </button>
      </form>

      {error ? (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 14 }}>{error}</p>
      ) : null}

      {report.query ? (
        report.conflicts.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "0.5rem" }}>Rule</th>
                  <th style={{ padding: "0.5rem" }}>Action</th>
                  <th style={{ padding: "0.5rem" }}>Priority</th>
                  <th style={{ padding: "0.5rem" }}>Overlap reason</th>
                </tr>
              </thead>
              <tbody>
                {report.conflicts.map((item) => (
                  <tr key={`${item.ruleId}-${item.overlapReason}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.5rem" }}>
                      <div style={{ fontWeight: 600 }}>{item.ruleName}</div>
                      <div style={{ fontFamily: "monospace", color: "#64748b", fontSize: 12 }}>
                        {item.ruleId}
                      </div>
                    </td>
                    <td style={{ padding: "0.5rem" }}>{item.action}</td>
                    <td style={{ padding: "0.5rem" }}>{item.priority}</td>
                    <td style={{ padding: "0.5rem" }}>{item.overlapReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ margin: 0, color: "#15803d", fontSize: 14 }}>
            No conflicts found for "{report.query}" in {report.environment}.
          </p>
        )
      ) : (
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
          Enter a query and inspect conflicts to generate a report.
        </p>
      )}
    </section>
  );
}
