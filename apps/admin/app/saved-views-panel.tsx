"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useCallback, useEffect, useState } from "react";
import type {
  SavedViewDto,
  SavedViewListResponseDto,
  WorkspaceRole,
} from "@retailer-search/shared-types";
import {
  WORKSPACE_ROLE_CHANGED_EVENT,
  WORKSPACE_ROLE_STORAGE_KEY,
} from "./workspace-switcher";

export const WORKSPACE_VIEW_CHANGED_EVENT = "admin:workspace-view-changed";

const inputStyle = {
  padding: "0.45rem 0.6rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 12,
  width: "100%",
  fontFamily: "inherit",
} as const;

interface SavedViewsPanelProps {
  activeRole: WorkspaceRole;
  selectedViewId: string | null;
  onSelectView: (view: SavedViewDto | null) => void;
  currentFilters: Record<string, unknown>;
}

export function SavedViewsPanel({
  activeRole,
  selectedViewId,
  onSelectView,
  currentFilters,
}: SavedViewsPanelProps) {
  const [views, setViews] = useState<SavedViewDto[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadViews = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/saved-views?role=${encodeURIComponent(activeRole)}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`Failed to load saved views: HTTP ${response.status}`);
      }

      const body = (await response.json()) as SavedViewListResponseDto;
      setViews(body.savedViews);

      const defaultView = body.savedViews.find((view) => view.isDefault);
      if (defaultView && !selectedViewId) {
        onSelectView(defaultView);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load saved views",
      );
    } finally {
      setLoading(false);
    }
  }, [activeRole, onSelectView]);

  useEffect(() => {
    void loadViews();
  }, [loadViews]);

  useEffect(() => {
    const handler = () => {
      void loadViews();
    };

    window.addEventListener(WORKSPACE_ROLE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(WORKSPACE_ROLE_CHANGED_EVENT, handler);
  }, [loadViews]);

  const createView = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Saved view name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/saved-views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          role: activeRole,
          description: description.trim() || undefined,
          filters: currentFilters,
        }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Create saved view failed with HTTP ${response.status}`);
      }

      setName("");
      setDescription("");
      setFeedback("Saved view created.");
      await loadViews();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Failed to create saved view",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateSelectedView = async () => {
    if (!selectedViewId) {
      setError("Select a saved view to update.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/saved-views/${selectedViewId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: description.trim() || undefined,
            filters: currentFilters,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Update saved view failed with HTTP ${response.status}`);
      }

      setFeedback("Saved view updated.");
      await loadViews();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Failed to update saved view",
      );
    } finally {
      setSaving(false);
    }
  };

  const setDefaultView = async (viewId: string) => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/saved-views/${viewId}/default`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: activeRole }),
        },
      );

      if (!response.ok) {
        throw new Error(`Set default failed with HTTP ${response.status}`);
      }

      setFeedback("Default saved view updated.");
      await loadViews();
    } catch (defaultError) {
      setError(
        defaultError instanceof Error ? defaultError.message : "Failed to set default view",
      );
    } finally {
      setSaving(false);
    }
  };

  const applyView = (view: SavedViewDto) => {
    onSelectView(view);
    window.dispatchEvent(
      new CustomEvent(WORKSPACE_VIEW_CHANGED_EVENT, { detail: { view } }),
    );
  };

  return (
    <section
      style={{
        padding: "0.85rem",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Saved views</h2>
      <p style={{ margin: "0 0 0.75rem", fontSize: 12, color: "#64748b" }}>
        Role-scoped shortcuts for {activeRole.replace("_", " ")}. Active role stored in{" "}
        {WORKSPACE_ROLE_STORAGE_KEY}.
      </p>

      {error && (
        <p style={{ margin: "0 0 0.5rem", color: "#b91c1c", fontSize: 12 }}>{error}</p>
      )}
      {feedback && (
        <p style={{ margin: "0 0 0.5rem", color: "#15803d", fontSize: 12 }}>{feedback}</p>
      )}

      {loading && (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Loading saved views...</p>
      )}

      {!loading && views.length === 0 && (
        <p style={{ margin: "0 0 0.75rem", fontSize: 12, color: "#94a3b8" }}>
          No saved views for this role yet.
        </p>
      )}

      {!loading && views.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: "0 0 0.75rem",
            padding: 0,
            display: "grid",
            gap: "0.45rem",
          }}
        >
          {views.map((view) => (
            <li
              key={view.id}
              style={{
                padding: "0.6rem",
                border:
                  selectedViewId === view.id
                    ? "1px solid var(--forge-primary)"
                    : "1px solid var(--forge-border)",
                borderRadius: 8,
                fontSize: 12,
                background: selectedViewId === view.id ? "#f8fafc" : "#fff",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <strong>{view.name}</strong>
                {view.isDefault && (
                  <span style={{ color: "#15803d", fontWeight: 600 }}>default</span>
                )}
              </div>
              {view.description && (
                <p style={{ margin: "0.25rem 0", color: "#64748b" }}>{view.description}</p>
              )}
              <p style={{ margin: "0 0 0.35rem", color: "#94a3b8" }}>
                {JSON.stringify(view.filters)}
              </p>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => applyView(view)}
                  style={{
                    padding: "0.25rem 0.5rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  Apply
                </button>
                <button
                  type="button"
                  disabled={saving || view.isDefault}
                  onClick={() => void setDefaultView(view.id)}
                  style={{
                    padding: "0.25rem 0.5rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: view.isDefault ? "not-allowed" : "pointer",
                    fontSize: 11,
                  }}
                >
                  Set default
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(event) => void createView(event)}
        style={{ display: "grid", gap: "0.45rem" }}
      >
        <strong style={{ fontSize: 13 }}>Save current filters</strong>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="View name"
          style={inputStyle}
        />
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description (optional)"
          style={inputStyle}
        />
        <pre
          style={{
            margin: 0,
            padding: "0.5rem",
            borderRadius: 6,
            background: "#f8fafc",
            fontSize: 11,
            overflowX: "auto",
          }}
        >
          {JSON.stringify(currentFilters, null, 2)}
        </pre>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "0.4rem 0.7rem",
              border: "none",
              borderRadius: 6,
              background: "var(--forge-primary)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {saving ? "Saving..." : "Create saved view"}
          </button>
          <button
            type="button"
            disabled={saving || !selectedViewId}
            onClick={() => void updateSelectedView()}
            style={{
              padding: "0.4rem 0.7rem",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Update selected view
          </button>
          <button
            type="button"
            disabled={!selectedViewId}
            onClick={() => onSelectView(null)}
            style={{
              padding: "0.4rem 0.7rem",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Clear selection
          </button>
        </div>
      </form>
    </section>
  );
}
