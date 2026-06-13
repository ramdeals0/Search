"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useCallback, useEffect, useState } from "react";
import type {
  ExperimentRunSummaryDto,
  ExperimentScorecardDto,
} from "@retailer-search/shared-types";

const HEADLINE_COLORS: Record<ExperimentScorecardDto["headlineStatus"], string> =
  {
    pass: "#15803d",
    fail: "#b91c1c",
    review: "#b45309",
  };

const METRIC_STATUS_COLORS: Record<
  ExperimentScorecardDto["metrics"][number]["status"],
  string
> = {
  good: "#15803d",
  warning: "#b45309",
  bad: "#b91c1c",
  neutral: "#64748b",
};

function formatMetricValue(key: string, value: number): string {
  if (key === "improvementRate" || key === "regressionRate") {
    return `${(value * 100).toFixed(0)}%`;
  }
  return String(value);
}

export function ScorecardPanel() {
  const [experimentId, setExperimentId] = useState<string | null>(null);
  const [scorecard, setScorecard] = useState<ExperimentScorecardDto | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadScorecard = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/experiments/${id}/scorecard`,
        { cache: "no-store" },
      );

      if (response.status === 404) {
        setScorecard(null);
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load scorecard: HTTP ${response.status}`);
      }

      setScorecard((await response.json()) as ExperimentScorecardDto);
    } catch (loadError) {
      setScorecard(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load scorecard",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<ExperimentRunSummaryDto>;
      const id = custom.detail.experimentId;
      setExperimentId(id);
      setFeedback(null);
      void loadScorecard(id);
    };

    window.addEventListener("admin:experiment-run", handler);
    return () => window.removeEventListener("admin:experiment-run", handler);
  }, [loadScorecard]);

  const generateScorecard = async () => {
    if (!experimentId) {
      return;
    }

    setGenerating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/experiments/${experimentId}/scorecard/generate`,
        { method: "POST" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          body?.error ?? `Generate scorecard failed with HTTP ${response.status}`,
        );
      }

      const generated = (await response.json()) as ExperimentScorecardDto;
      setScorecard(generated);
      setFeedback("Scorecard generated from the latest experiment run.");
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Failed to generate scorecard",
      );
    } finally {
      setGenerating(false);
    }
  };

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
          flexWrap: "wrap",
          marginBottom: "0.75rem",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Experiment scorecard</h2>
        <button
          type="button"
          onClick={() => void generateScorecard()}
          disabled={!experimentId || generating}
          style={{
            padding: "0.45rem 0.75rem",
            border: "none",
            borderRadius: 6,
            background: experimentId ? "var(--forge-primary)" : "#94a3b8",
            color: "#fff",
            cursor: experimentId ? "pointer" : "not-allowed",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {generating ? "Generating..." : "Generate scorecard"}
        </button>
      </div>

      <p style={{ margin: "0 0 0.75rem", fontSize: 13, color: "#64748b" }}>
        Step 3: after reviewing run results, generate a pass/fail/review
        scorecard from guardrails. No statistical significance — decision support
        only.
      </p>

      {!experimentId && (
        <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
          Run an experiment first to enable scorecard generation.
        </p>
      )}

      {experimentId && loading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Loading scorecard...
        </p>
      )}

      {feedback && (
        <p style={{ margin: "0 0 0.75rem", color: "#15803d", fontSize: 13 }}>
          {feedback}
        </p>
      )}
      {error && (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 13 }}>
          {error}
        </p>
      )}

      {experimentId && !loading && !scorecard && !error && (
        <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
          No scorecard yet. Generate one from the latest run.
        </p>
      )}

      {scorecard && (
        <div style={{ display: "grid", gap: "0.85rem" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                color: HEADLINE_COLORS[scorecard.headlineStatus],
              }}
            >
              {scorecard.headlineStatus}
            </span>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Generated {new Date(scorecard.generatedAt).toLocaleString()}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: 14, color: "#334155" }}>
            {scorecard.summary}
          </p>

          {scorecard.guardrailFindings.length > 0 && (
            <ul
              style={{
                margin: 0,
                paddingLeft: "1.1rem",
                fontSize: 13,
                color: "#475569",
              }}
            >
              {scorecard.guardrailFindings.map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
            </ul>
          )}

          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: "0.5rem",
            }}
          >
            {scorecard.metrics.map((metric) => (
              <li
                key={metric.key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  alignItems: "center",
                  padding: "0.55rem 0.65rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <div>
                  <strong>{metric.label}</strong>
                  {metric.description && (
                    <p style={{ margin: "0.15rem 0 0", color: "#64748b" }}>
                      {metric.description}
                    </p>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {formatMetricValue(metric.key, metric.value)}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: METRIC_STATUS_COLORS[metric.status],
                    }}
                  >
                    {metric.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
