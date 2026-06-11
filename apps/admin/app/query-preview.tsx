"use client";

import { useState } from "react";
import type { QueryPreviewResponseDto } from "@retailer-search/shared-types";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

export function QueryPreview() {
  const [query, setQuery] = useState("rice");
  const [preview, setPreview] = useState<QueryPreviewResponseDto | null>(null);
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
      const url = new URL("/api/v1/admin/query-preview", SEARCH_API_URL);
      url.searchParams.set("query", trimmed);
      url.searchParams.set("pageSize", "10");

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Preview failed with HTTP ${response.status}`);
      }

      setPreview((await response.json()) as QueryPreviewResponseDto);
    } catch (previewError) {
      setPreview(null);
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Preview failed",
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

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Enter a search query"
          style={{
            flex: 1,
            padding: "0.55rem 0.7rem",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            fontSize: 14,
          }}
        />
        <button
          type="button"
          onClick={() => void runPreview()}
          disabled={loading}
          style={{
            padding: "0.55rem 0.9rem",
            border: "none",
            borderRadius: 6,
            background: "#0f172a",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          {loading ? "Running..." : "Preview"}
        </button>
      </div>

      {error && (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p>
      )}

      {preview && (
        <>
          <p style={{ margin: "0 0 0.75rem", fontSize: 14, color: "#475569" }}>
            {preview.total} result{preview.total === 1 ? "" : "s"} for{" "}
            <strong>{preview.query}</strong>
          </p>
          {preview.appliedRuleNames.length > 0 && (
            <p style={{ margin: "0 0 0.75rem", fontSize: 13, color: "#64748b" }}>
              Applied rules: {preview.appliedRuleNames.join(", ")}
            </p>
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
            {preview.hits.map((hit) => (
              <li
                key={hit.id}
                style={{
                  padding: "0.75rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              >
                <strong>{hit.title}</strong>
                <span style={{ color: "#64748b" }}>
                  {" "}
                  · {hit.brand} · {hit.category}
                </span>
                <span style={{ float: "right", color: "#475569" }}>
                  score {hit.score.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
