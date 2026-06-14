"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  RuleDraftDto,
  ZeroResultInsightsResponseDto,
} from "@retailer-search/shared-types";
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
  padding: "0.4rem 0.7rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
} as const;

const primaryButtonStyle = {
  ...buttonStyle,
  background: "#0f172a",
  color: "#fff",
  borderColor: "#0f172a",
} as const;

export function ZeroResultsPanel() {
  const [insights, setInsights] = useState<ZeroResultInsightsResponseDto>({
    total: 0,
    queries: [],
  });
  const [drafts, setDrafts] = useState<RuleDraftDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyQuery, setBusyQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [insightsRes, draftsRes] = await Promise.all([
        fetch(`${getSearchApiUrl()}/api/v1/admin/analytics/zero-results?limit=25`, {
          cache: "no-store",
        }),
        fetch(`${getSearchApiUrl()}/api/v1/admin/rule-drafts`, { cache: "no-store" }),
      ]);

      if (!insightsRes.ok) {
        throw new Error(`Failed to load zero-result queries (${insightsRes.status})`);
      }

      setInsights((await insightsRes.json()) as ZeroResultInsightsResponseDto);

      if (draftsRes.ok) {
        const payload = (await draftsRes.json()) as { drafts: RuleDraftDto[] };
        setDrafts(payload.drafts ?? []);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const generateDraft = async (query: string) => {
    setBusyQuery(query);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/rule-drafts/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        },
      );

      if (!response.ok) {
        throw new Error(`Generate draft failed (${response.status})`);
      }

      setFeedback(`Draft generated for "${query}". Review below and approve before apply.`);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Generate failed");
    } finally {
      setBusyQuery(null);
    }
  };

  const updateDraft = async (
    draftId: string,
    action: "approve" | "reject" | "apply",
  ) => {
    setBusyQuery(draftId);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/rule-drafts/${draftId}/${action}`,
        { method: "POST" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `${action} failed (${response.status})`);
      }

      setFeedback(`Draft ${action}${action === "apply" ? "ied to staging" : "d"}.`);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed");
    } finally {
      setBusyQuery(null);
    }
  };

  const pendingDrafts = drafts.filter((draft) => draft.status === "pending_review");
  const approvedDrafts = drafts.filter((draft) => draft.status === "approved");

  return (
    <section style={panelStyle}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>Zero-results inbox</h2>
      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Persistent zero-result queries from analytics. Generate LLM-assisted rule drafts,
        approve them, then apply to staging.
      </p>

      {error ? (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 14 }}>{error}</p>
      ) : null}
      {feedback ? (
        <p style={{ margin: "0 0 0.75rem", color: "#15803d", fontSize: 14 }}>{feedback}</p>
      ) : null}

      {loading ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Loading inbox...</p>
      ) : insights.queries.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          No zero-result queries recorded yet.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "0.5rem" }}>Query</th>
                <th style={{ padding: "0.5rem" }}>Count</th>
                <th style={{ padding: "0.5rem" }}>Last seen</th>
                <th style={{ padding: "0.5rem" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {insights.queries.map((row) => (
                <tr key={row.query} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.5rem" }}>
                    <code>{row.query}</code>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{row.count}</td>
                  <td style={{ padding: "0.5rem", color: "#64748b" }}>
                    {new Date(row.lastSeenAt).toLocaleString()}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <button
                      type="button"
                      style={primaryButtonStyle}
                      disabled={busyQuery === row.query}
                      onClick={() => void generateDraft(row.query)}
                    >
                      {busyQuery === row.query ? "Generating..." : "Generate draft"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(pendingDrafts.length > 0 || approvedDrafts.length > 0) && (
        <div style={{ marginTop: "1.25rem" }}>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Rule drafts</h3>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {[...pendingDrafts, ...approvedDrafts].slice(0, 8).map((draft) => (
              <div
                key={draft.id}
                style={{
                  padding: "0.75rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                  <div>
                    <strong>{draft.query}</strong>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                      {draft.status} · {draft.source}
                    </div>
                    {draft.rationale ? (
                      <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                        {draft.rationale}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    {draft.status === "pending_review" ? (
                      <>
                        <button
                          type="button"
                          style={buttonStyle}
                          disabled={busyQuery === draft.id}
                          onClick={() => void updateDraft(draft.id, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          style={buttonStyle}
                          disabled={busyQuery === draft.id}
                          onClick={() => void updateDraft(draft.id, "reject")}
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                    {draft.status === "approved" ? (
                      <button
                        type="button"
                        style={primaryButtonStyle}
                        disabled={busyQuery === draft.id}
                        onClick={() => void updateDraft(draft.id, "apply")}
                      >
                        Apply to staging
                      </button>
                    ) : null}
                  </div>
                </div>
                <pre
                  style={{
                    margin: "0.5rem 0 0",
                    padding: "0.5rem",
                    fontSize: 12,
                    background: "#fff",
                    borderRadius: 6,
                    overflow: "auto",
                  }}
                >
                  {JSON.stringify(draft.suggestedRule, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
