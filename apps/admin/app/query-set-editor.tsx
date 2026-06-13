"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useState } from "react";
import type { EvaluationQueryDto } from "@retailer-search/shared-types";

const inputStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
} as const;

const emptyQuery: EvaluationQueryDto = {
  query: "",
  expectedProductIds: [],
  notes: "",
  tags: [],
};

export function QuerySetEditor() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [queries, setQueries] = useState<EvaluationQueryDto[]>([
    { query: "drill", expectedProductIds: ["prod-021"] },
    { query: "impact driver" },
    { query: "fasteners", tags: ["category-browse"] },
  ]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateQuery = (
    index: number,
    field: keyof EvaluationQueryDto,
    value: string,
  ) => {
    setQueries((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (field === "expectedProductIds" || field === "tags") {
          const parts = value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
          return { ...item, [field]: parts.length > 0 ? parts : undefined };
        }

        return {
          ...item,
          [field]: value.trim() ? value.trim() : undefined,
        };
      }),
    );
  };

  const addQuery = () => {
    setQueries((current) => [...current, { ...emptyQuery, query: "" }]);
  };

  const removeQuery = (index: number) => {
    setQueries((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const saveQuerySet = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const validQueries = queries.filter((item) => item.query.trim().length > 0);

    if (!trimmedName || validQueries.length === 0) {
      setError("Name and at least one query are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/query-sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || undefined,
          queries: validQueries,
        }),
      });

      if (!response.ok) {
        throw new Error(`Create query set failed with HTTP ${response.status}`);
      }

      setFeedback("Query set saved.");
      setName("");
      setDescription("");
      window.dispatchEvent(new CustomEvent("admin:query-set-created"));
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save query set",
      );
    } finally {
      setSaving(false);
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
      <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>
        Evaluation query sets
      </h2>

      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Save representative test queries with optional expected product IDs for
        offline experiment evaluation.
      </p>

      <form onSubmit={(event) => void saveQuerySet(event)} style={{ display: "grid", gap: "0.75rem" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Query set name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Core catalog search queries"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Description (optional)
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Broad and narrow queries for drills and hardware"
            style={inputStyle}
          />
        </label>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          {queries.map((query, index) => (
            <div
              key={`query-${index}`}
              style={{
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                background: "#f8fafc",
                display: "grid",
                gap: "0.5rem",
              }}
            >
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                Query
                <input
                  value={query.query}
                  onChange={(event) => updateQuery(index, "query", event.target.value)}
                  placeholder="drill"
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                Expected product IDs (comma-separated)
                <input
                  value={query.expectedProductIds?.join(", ") ?? ""}
                  onChange={(event) =>
                    updateQuery(index, "expectedProductIds", event.target.value)
                  }
                  placeholder="prod-021, prod-015"
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                Notes
                <input
                  value={query.notes ?? ""}
                  onChange={(event) => updateQuery(index, "notes", event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                Tags (comma-separated)
                <input
                  value={query.tags?.join(", ") ?? ""}
                  onChange={(event) => updateQuery(index, "tags", event.target.value)}
                  placeholder="drill, hero-product"
                  style={inputStyle}
                />
              </label>
              {queries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuery(index)}
                  style={{
                    justifySelf: "start",
                    padding: "0.35rem 0.6rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Remove query
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={addQuery}
            style={{
              padding: "0.45rem 0.75rem",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Add query
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "0.55rem 0.9rem",
              border: "none",
              borderRadius: 6,
              background: "var(--forge-primary)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {saving ? "Saving..." : "Save query set"}
          </button>
        </div>
      </form>

      {feedback && (
        <p style={{ margin: "0.75rem 0 0", color: "#15803d", fontSize: 13 }}>
          {feedback}
        </p>
      )}
      {error && (
        <p style={{ margin: "0.75rem 0 0", color: "#b91c1c", fontSize: 13 }}>
          {error}
        </p>
      )}
    </section>
  );
}
