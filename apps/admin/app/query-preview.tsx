"use client";

import { useState } from "react";
import type {
  AiQueryPreviewResponseDto,
  AiSearchPreviewMode,
  SearchExplanationCode,
} from "@retailer-search/shared-types";
import { getAuthHeaders } from "./lib/auth-headers";
import { buildSearchApiUrl } from "./lib/search-api-url";
import { RankingScoreBreakdown } from "./ranking-score-breakdown";

const PREVIEW_MODE_OPTIONS: Array<{ value: AiSearchPreviewMode; label: string }> = [
  { value: "lexical", label: "Lexical only" },
  { value: "hybrid", label: "Hybrid" },
  { value: "hybrid_personalization", label: "Hybrid + personalization" },
  { value: "semantic_rescue", label: "Semantic rescue" },
];

const EXPLANATION_LABELS: Record<SearchExplanationCode, string> = {
  lexical_match: "Lexical match",
  semantic_match: "Semantic match",
  user_brand_affinity: "Brand affinity",
  user_category_affinity: "Category affinity",
  user_product_affinity: "Product affinity",
  merchandising_rule_applied: "Merchandising rule",
  zero_results_semantic_recovery: "Semantic recovery",
  personalization_rerank: "Personalization rerank",
};

function ExplanationChips({ codes }: { codes: SearchExplanationCode[] }) {
  if (codes.length === 0) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.5rem" }}>
      {codes.map((code) => (
        <span
          key={code}
          style={{
            display: "inline-block",
            padding: "0.15rem 0.45rem",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            background: "var(--forge-accent-subtle, #eff6ff)",
            color: "var(--forge-accent, #2563eb)",
            border: "1px solid var(--forge-accent-border-strong, #bfdbfe)",
          }}
        >
          {EXPLANATION_LABELS[code] ?? code}
        </span>
      ))}
    </div>
  );
}

export function QueryPreview() {
  const [query, setQuery] = useState("cordless drill");
  const [previewMode, setPreviewMode] = useState<AiSearchPreviewMode>("hybrid");
  const [sessionId, setSessionId] = useState("");
  const [preview, setPreview] = useState<AiQueryPreviewResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runPreview = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = buildSearchApiUrl("/api/v1/admin/ai-search/query-preview");
      url.searchParams.set("query", trimmed);
      url.searchParams.set("pageSize", "10");
      url.searchParams.set("previewMode", previewMode);
      if (sessionId.trim()) {
        url.searchParams.set("sessionId", sessionId.trim());
      }

      const response = await fetch(url.toString(), {
        headers: getAuthHeaders("none"),
      });
      if (!response.ok) {
        throw new Error(`Preview failed with HTTP ${response.status}`);
      }

      setPreview((await response.json()) as AiQueryPreviewResponseDto);
    } catch (previewError) {
      setPreview(null);
      setError(
        previewError instanceof Error ? previewError.message : "Preview failed",
      );
    } finally {
      setLoading(false);
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
      <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>Query preview</h2>

      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          marginBottom: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <label style={{ display: "grid", gap: 4, fontSize: 13, gridColumn: "1 / -1" }}>
          Query
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Enter a search query"
            style={{
              padding: "0.55rem 0.7rem",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              fontSize: 14,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Preview mode
          <select
            value={previewMode}
            onChange={(event) =>
              setPreviewMode(event.target.value as AiSearchPreviewMode)
            }
            style={{
              padding: "0.55rem 0.7rem",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            {PREVIEW_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Session ID (optional)
          <input
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            placeholder="For personalization preview"
            style={{
              padding: "0.55rem 0.7rem",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              fontSize: 14,
            }}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => void runPreview()}
        disabled={loading}
        style={{
          padding: "0.55rem 0.9rem",
          border: "none",
          borderRadius: 6,
          background: "var(--forge-primary)",
          color: "#fff",
          cursor: "pointer",
          marginBottom: "1rem",
        }}
      >
        {loading ? "Running..." : "Preview"}
      </button>

      {error && (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p>
      )}

      {preview && (
        <>
          <p style={{ margin: "0 0 0.75rem", fontSize: 14, color: "#475569" }}>
            {preview.total} result{preview.total === 1 ? "" : "s"} for{" "}
            <strong>{preview.query}</strong>
            {" · "}
            mode <strong>{preview.previewMode}</strong>
          </p>

          {preview.appliedRuleNames.length > 0 && (
            <p style={{ margin: "0 0 0.75rem", fontSize: 13, color: "#64748b" }}>
              Applied rules: {preview.appliedRuleNames.join(", ")}
            </p>
          )}

          {preview.aiRankingDebug ? (
            <div
              style={{
                marginBottom: "0.75rem",
                padding: "0.65rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                background: "#f8fafc",
                fontSize: 12,
                color: "#475569",
              }}
            >
              <strong style={{ fontSize: 13, color: "var(--forge-text)" }}>
                AI ranking debug
              </strong>
              <div style={{ marginTop: "0.35rem", display: "grid", gap: 2 }}>
                <span>
                  Mode: {preview.aiRankingDebug.rankingMode} · Provider:{" "}
                  {preview.aiRankingDebug.embeddingProvider} · Model:{" "}
                  {preview.aiRankingDebug.embeddingModel}
                </span>
                <span>
                  Weights L/S/P:{" "}
                  {preview.aiRankingDebug.lexicalWeight.toFixed(2)} /{" "}
                  {preview.aiRankingDebug.semanticWeight.toFixed(2)} /{" "}
                  {preview.aiRankingDebug.personalizationWeight.toFixed(2)}
                </span>
                <span>
                  Semantic hits: {preview.aiRankingDebug.semanticHits}
                  {preview.aiRankingDebug.semanticRecoveryApplied
                    ? " · semantic recovery applied"
                    : ""}
                  {preview.aiRankingDebug.experimentArm
                    ? ` · experiment arm: ${preview.aiRankingDebug.experimentArm}`
                    : ""}
                </span>
              </div>
            </div>
          ) : null}

          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: "0.5rem",
            }}
          >
            {preview.hits.map((hit, index) => (
              <li
                key={hit.id}
                style={{
                  padding: "0.75rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <strong>{hit.title}</strong>
                    <span style={{ color: "#64748b" }}>
                      {" "}
                      · {hit.brand} · {hit.category}
                    </span>
                  </div>
                  <span
                    style={{
                      color: "#475569",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    score {hit.score.toFixed(1)}
                  </span>
                </div>
                {hit.rankingDebug?.explanationCodes?.length ? (
                  <ExplanationChips
                    codes={hit.rankingDebug.explanationCodes as SearchExplanationCode[]}
                  />
                ) : null}
                {hit.rankingDebug ? (
                  <RankingScoreBreakdown rankingDebug={hit.rankingDebug} rank={index + 1} />
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
