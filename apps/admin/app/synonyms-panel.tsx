"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  EnvironmentKey,
  SynonymEntryDto,
  SynonymListResponseDto,
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

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function buildSynonymUrl(key?: string, environment: EnvironmentKey = "staging"): string {
  const base = `${getSearchApiUrl()}/api/v1/admin/synonyms`;
  const params = new URLSearchParams({ environment });
  if (key) {
    return `${base}/${encodeURIComponent(key)}?${params.toString()}`;
  }
  return `${base}?${params.toString()}`;
}

export function SynonymsPanel() {
  const [environment, setEnvironment] = useState<EnvironmentKey>("staging");
  const [synonyms, setSynonyms] = useState<SynonymEntryDto[]>([]);
  const [filter, setFilter] = useState("");
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadSynonyms = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(buildSynonymUrl(undefined, environment), {
        cache: "no-store",
      });

      if (response.status === 404) {
        throw new Error(
          "Synonyms API not found (404). Restart search-api (pnpm --filter @retailer-search/search-api dev) to load the latest routes.",
        );
      }

      if (!response.ok) {
        throw new Error(`Failed to load synonyms (${response.status})`);
      }

      const body = (await response.json()) as SynonymListResponseDto;
      setSynonyms(body.synonyms ?? []);
    } catch (loadError) {
      setSynonyms([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load synonyms");
    } finally {
      setLoading(false);
    }
  }, [environment]);

  useEffect(() => {
    void loadSynonyms();
  }, [loadSynonyms]);

  useEffect(() => {
    setPage(1);
  }, [filter, environment, pageSize]);

  const filteredSynonyms = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      return synonyms;
    }

    return synonyms.filter(
      (entry) =>
        entry.key.includes(query) ||
        entry.value.includes(query),
    );
  }, [filter, synonyms]);

  const totalPages = Math.max(1, Math.ceil(filteredSynonyms.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedSynonyms = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSynonyms.slice(start, start + pageSize);
  }, [filteredSynonyms, currentPage, pageSize]);

  const rangeStart =
    filteredSynonyms.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filteredSynonyms.length);

  const createSynonym = async () => {
    setBusy(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(buildSynonymUrl(undefined, environment), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey, value: newValue }),
      });

      if (response.status === 409) {
        throw new Error("That source term already has a synonym mapping.");
      }

      if (!response.ok) {
        throw new Error(`Create failed (${response.status})`);
      }

      setNewKey("");
      setNewValue("");
      setFeedback("Synonym added.");
      await loadSynonyms();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (key: string) => {
    setBusy(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(buildSynonymUrl(key, environment), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: editValue }),
      });

      if (!response.ok) {
        throw new Error(`Update failed (${response.status})`);
      }

      setEditingKey(null);
      setEditValue("");
      setFeedback(`Updated "${key}".`);
      await loadSynonyms();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const removeSynonym = async (key: string) => {
    if (!window.confirm(`Delete synonym mapping for "${key}"?`)) {
      return;
    }

    setBusy(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(buildSynonymUrl(key, environment), {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Delete failed (${response.status})`);
      }

      if (editingKey === key) {
        setEditingKey(null);
        setEditValue("");
      }

      setFeedback(`Deleted "${key}".`);
      await loadSynonyms();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.1rem" }}>Synonym mappings</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Token-level query normalization for shopper language. Changes apply to the
            selected environment.
          </p>
        </div>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Environment
          <select
            value={environment}
            onChange={(event) =>
              setEnvironment(event.target.value as EnvironmentKey)
            }
            style={{ ...inputStyle, width: "auto", minWidth: 140 }}
            disabled={busy}
          >
            <option value="staging">Staging</option>
            <option value="live">Live</option>
          </select>
        </label>
      </div>

      {error ? (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 14 }}>{error}</p>
      ) : null}
      {feedback ? (
        <p style={{ margin: "0 0 0.75rem", color: "#15803d", fontSize: 14 }}>{feedback}</p>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Source term
          <input
            style={inputStyle}
            value={newKey}
            onChange={(event) => setNewKey(event.target.value)}
            placeholder="shop vac"
            disabled={busy}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Maps to
          <input
            style={inputStyle}
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
            placeholder="wet dry vacuum"
            disabled={busy}
          />
        </label>
        <div style={{ display: "flex", alignItems: "end" }}>
          <button
            type="button"
            style={primaryButtonStyle}
            disabled={busy || !newKey.trim() || !newValue.trim()}
            onClick={() => void createSynonym()}
          >
            Add synonym
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "end",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <label style={{ display: "grid", gap: 4, fontSize: 13, flex: 1, minWidth: 220 }}>
          Filter
          <input
            style={inputStyle}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search source or target terms"
            disabled={loading}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Rows per page
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value) as PageSize)}
            style={{ ...inputStyle, width: "auto", minWidth: 100 }}
            disabled={loading}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Loading synonyms...</p>
      ) : filteredSynonyms.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          {synonyms.length === 0
            ? "No synonyms in this environment yet."
            : "No synonyms match your filter."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "0.5rem" }}>Source term</th>
                <th style={{ padding: "0.5rem" }}>Maps to</th>
                <th style={{ padding: "0.5rem", width: 180 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSynonyms.map((entry) => {
                const isEditing = editingKey === entry.key;

                return (
                  <tr key={entry.key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>
                      {entry.key}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      {isEditing ? (
                        <input
                          style={inputStyle}
                          value={editValue}
                          onChange={(event) => setEditValue(event.target.value)}
                          disabled={busy}
                        />
                      ) : (
                        <span style={{ fontFamily: "monospace" }}>{entry.value}</span>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              style={primaryButtonStyle}
                              disabled={busy || !editValue.trim()}
                              onClick={() => void saveEdit(entry.key)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              style={buttonStyle}
                              disabled={busy}
                              onClick={() => {
                                setEditingKey(null);
                                setEditValue("");
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              style={buttonStyle}
                              disabled={busy}
                              onClick={() => {
                                setEditingKey(entry.key);
                                setEditValue(entry.value);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              style={buttonStyle}
                              disabled={busy}
                              onClick={() => void removeSynonym(entry.key)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "0.75rem",
              fontSize: 13,
              color: "#64748b",
            }}
          >
            <span>
              Showing {rangeStart}–{rangeEnd} of {filteredSynonyms.length}
              {filter.trim() && filteredSynonyms.length !== synonyms.length
                ? ` (filtered from ${synonyms.length})`
                : ""}
            </span>
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <button
                type="button"
                style={buttonStyle}
                disabled={busy || currentPage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <span style={{ minWidth: "4.5rem", textAlign: "center" }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                style={buttonStyle}
                disabled={busy || currentPage >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading ? (
        <p style={{ margin: "0.75rem 0 0", fontSize: 12, color: "#94a3b8" }}>
          {synonyms.length} synonym{synonyms.length === 1 ? "" : "s"} in {environment}
        </p>
      ) : null}
    </section>
  );
}
