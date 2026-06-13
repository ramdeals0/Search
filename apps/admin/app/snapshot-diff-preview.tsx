"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useEffect, useState } from "react";
import type { SnapshotDiffResponseDto } from "@retailer-search/shared-types";

const TYPE_LABELS: Record<string, string> = {
  rule_added: "Rule added",
  rule_removed: "Rule removed",
  rule_changed: "Rule changed",
  synonym_added: "Synonym added",
  synonym_removed: "Synonym removed",
  synonym_changed: "Synonym changed",
};

const TYPE_COLORS: Record<string, string> = {
  rule_added: "#15803d",
  rule_removed: "#b91c1c",
  rule_changed: "#b45309",
  synonym_added: "#15803d",
  synonym_removed: "#b91c1c",
  synonym_changed: "#b45309",
};

interface SnapshotDiffPreviewProps {
  fromSnapshotId: string;
  toSnapshotId: string;
}

export function SnapshotDiffPreview({
  fromSnapshotId,
  toSnapshotId,
}: SnapshotDiffPreviewProps) {
  const [diff, setDiff] = useState<SnapshotDiffResponseDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fromSnapshotId || !toSnapshotId) {
      setDiff(null);
      return;
    }

    let cancelled = false;

    const loadDiff = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = new URL("/api/v1/admin/snapshots/diff", getSearchApiUrl());
        url.searchParams.set("from", fromSnapshotId);
        url.searchParams.set("to", toSnapshotId);

        const response = await fetch(url.toString(), { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Diff failed with HTTP ${response.status}`);
        }

        if (!cancelled) {
          setDiff((await response.json()) as SnapshotDiffResponseDto);
        }
      } catch (loadError) {
        if (!cancelled) {
          setDiff(null);
          setError(
            loadError instanceof Error ? loadError.message : "Diff failed",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDiff();

    return () => {
      cancelled = true;
    };
  }, [fromSnapshotId, toSnapshotId]);

  if (!fromSnapshotId || !toSnapshotId) {
    return null;
  }

  if (fromSnapshotId === toSnapshotId) {
    return (
      <p style={{ margin: "0.75rem 0 0", fontSize: 13, color: "#64748b" }}>
        Select two different snapshots to compare.
      </p>
    );
  }

  return (
    <div
      style={{
        marginTop: "0.75rem",
        padding: "0.85rem",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#f8fafc",
      }}
    >
      <h3 style={{ margin: "0 0 0.75rem", fontSize: 14 }}>Snapshot diff</h3>

      {loading && (
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          Loading diff...
        </p>
      )}

      {error && (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>{error}</p>
      )}

      {!loading && !error && diff && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "0.5rem",
              marginBottom: "0.75rem",
              fontSize: 12,
              color: "#475569",
            }}
          >
            <span>Rules +{diff.summary.rulesAdded}</span>
            <span>Rules -{diff.summary.rulesRemoved}</span>
            <span>Rules ~{diff.summary.rulesChanged}</span>
            <span>Synonyms +{diff.summary.synonymsAdded}</span>
            <span>Synonyms -{diff.summary.synonymsRemoved}</span>
            <span>Synonyms ~{diff.summary.synonymsChanged}</span>
          </div>

          {diff.items.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              No differences between these snapshots.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: "0.5rem",
              }}
            >
              {diff.items.map((item, index) => (
                <li
                  key={`${item.type}-${item.key}-${index}`}
                  style={{
                    padding: "0.65rem",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    background: "#fff",
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
                    <strong>{item.key}</strong>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: TYPE_COLORS[item.type] ?? "#64748b",
                      }}
                    >
                      {TYPE_LABELS[item.type] ?? item.type}
                    </span>
                  </div>

                  {(item.before || item.after) && (
                    <details>
                      <summary style={{ cursor: "pointer", color: "#64748b" }}>
                        View before/after
                      </summary>
                      <pre
                        style={{
                          margin: "0.5rem 0 0",
                          padding: "0.55rem",
                          borderRadius: 6,
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          fontSize: 11,
                          overflowX: "auto",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {JSON.stringify(
                          { before: item.before, after: item.after },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
