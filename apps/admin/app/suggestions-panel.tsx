"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type {
  ApplySuggestionResponseDto,
  RuleSuggestionDto,
  SuggestionActionType,
  SuggestionsResponseDto,
} from "@retailer-search/shared-types";
import { ActionPreview } from "./action-preview";

const PRIORITY_COLORS: Record<string, string> = {
  high: "#b91c1c",
  medium: "#b45309",
  low: "#64748b",
};

const ACTION_LABELS: Record<SuggestionActionType, string> = {
  create_rule: "Create rule",
  create_synonym: "Create synonym",
  open_query_preview: "Preview query",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      style={{
        padding: "0.3rem 0.55rem",
        border: "1px solid #cbd5e1",
        borderRadius: 6,
        background: "#fff",
        cursor: "pointer",
        fontSize: 12,
      }}
    >
      {copied ? "Copied" : "Copy recommendation"}
    </button>
  );
}

function formatMetrics(suggestion: RuleSuggestionDto): string {
  const parts: string[] = [];
  const metrics = suggestion.metrics;

  if (!metrics) {
    return "";
  }

  if (metrics.searches !== undefined) {
    parts.push(`${metrics.searches} searches`);
  }
  if (metrics.clicks !== undefined) {
    parts.push(`${metrics.clicks} clicks`);
  }
  if (metrics.ctr !== undefined) {
    parts.push(`${(metrics.ctr * 100).toFixed(0)}% CTR`);
  }
  if (metrics.zeroResults !== undefined && metrics.zeroResults > 0) {
    parts.push(`${metrics.zeroResults} zero-result`);
  }

  return parts.join(" · ");
}

interface SelectedAction {
  suggestion: RuleSuggestionDto;
  actionType: SuggestionActionType;
}

export function SuggestionsPanel() {
  const router = useRouter();
  const [data, setData] = useState<SuggestionsResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState<SelectedAction | null>(
    null,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [previewQueryHint, setPreviewQueryHint] = useState<string | null>(null);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/suggestions`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`Failed to load suggestions: HTTP ${response.status}`);
      }

      setData((await response.json()) as SuggestionsResponseDto);
    } catch (loadError) {
      setData(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load suggestions",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  const handleApplySuccess = (result: ApplySuggestionResponseDto) => {
    setFeedback(result.message);

    if (result.previewQuery) {
      setPreviewQueryHint(result.previewQuery);
      document
        .getElementById("query-preview-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (result.createdRuleId || result.createdSynonymKey) {
      router.refresh();
    }

    window.setTimeout(() => {
      void loadSuggestions();
      setSelectedAction(null);
    }, 1200);
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
          alignItems: "baseline",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Rule suggestions</h2>
        {data && (
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            Generated {new Date(data.generatedAt).toLocaleString()}
          </span>
        )}
      </div>

      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Heuristic recommendations with assisted actions. Review each preview
        and confirm before anything changes.
      </p>

      {feedback && (
        <p
          style={{
            margin: "0 0 1rem",
            padding: "0.65rem 0.85rem",
            borderRadius: 6,
            background: "#ecfdf5",
            color: "#166534",
            fontSize: 13,
          }}
        >
          {feedback}
        </p>
      )}

      {previewQueryHint && (
        <p
          style={{
            margin: "0 0 1rem",
            padding: "0.65rem 0.85rem",
            borderRadius: 6,
            background: "#fef9c3",
            color: "#854d0e",
            fontSize: 13,
          }}
        >
          Suggested preview query: <strong>{previewQueryHint}</strong> — enter it
          in the query preview panel below.
        </p>
      )}

      {loading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Loading suggestions...
        </p>
      )}

      {error && (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p>
      )}

      {!loading && !error && data?.suggestions.length === 0 && (
        <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
          No suggestions yet. Run more storefront searches and clicks to build
          analytics signal.
        </p>
      )}

      {!loading && !error && data && data.suggestions.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: "0.75rem",
          }}
        >
          {data.suggestions.map((suggestion) => (
            <li
              key={suggestion.id}
              style={{
                padding: "0.85rem",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <strong>{suggestion.query}</strong>
                <span
                  style={{
                    fontSize: 12,
                    padding: "0.15rem 0.45rem",
                    borderRadius: 999,
                    background: "#f1f5f9",
                  }}
                >
                  {suggestion.type.replaceAll("_", " ")}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: PRIORITY_COLORS[suggestion.priority],
                    textTransform: "uppercase",
                  }}
                >
                  {suggestion.priority}
                </span>
              </div>

              <p style={{ margin: "0 0 0.35rem", color: "#334155" }}>
                {suggestion.reason}
              </p>
              <p style={{ margin: "0 0 0.5rem", color: "#475569" }}>
                <strong>Action:</strong> {suggestion.recommendedAction}
              </p>

              {formatMetrics(suggestion) && (
                <p style={{ margin: "0 0 0.5rem", fontSize: 12, color: "#64748b" }}>
                  {formatMetrics(suggestion)}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              >
                {(suggestion.suggestedActionTypes ?? []).map((actionType) => (
                  <button
                    key={actionType}
                    type="button"
                    onClick={() =>
                      setSelectedAction({ suggestion, actionType })
                    }
                    style={{
                      padding: "0.4rem 0.7rem",
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      background:
                        selectedAction?.suggestion.id === suggestion.id &&
                        selectedAction.actionType === actionType
                          ? "#e2e8f0"
                          : "#fff",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {ACTION_LABELS[actionType]}
                  </button>
                ))}
                <CopyButton text={suggestion.recommendedAction} />
              </div>

              {selectedAction?.suggestion.id === suggestion.id && (
                <ActionPreview
                  suggestion={selectedAction.suggestion}
                  actionType={selectedAction.actionType}
                  onClose={() => setSelectedAction(null)}
                  onSuccess={handleApplySuccess}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
