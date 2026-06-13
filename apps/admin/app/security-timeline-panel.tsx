"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useCallback, useEffect, useState } from "react";
import type { SecurityTimelineEntryDto, SecurityTimelineResponseDto } from "@retailer-search/shared-types";
import {
  AUTH_TOKEN_STORAGE_KEY,
  ACCESS_GOVERNANCE_CHANGED_EVENT,
} from "./access-request-panel";

const panelStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "1rem",
  background: "#fff",
} as const;

const inputStyle = {
  padding: "0.45rem 0.6rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 13,
} as const;

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
      : null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function severityColor(severity: SecurityTimelineEntryDto["severity"]): string {
  switch (severity) {
    case "critical":
      return "#b91c1c";
    case "warning":
      return "#b45309";
    default:
      return "#047857";
  }
}

export function SecurityTimelinePanel() {
  const [entries, setEntries] = useState<SecurityTimelineEntryDto[]>([]);
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (category.trim()) {
        params.set("category", category.trim());
      }
      if (severity.trim()) {
        params.set("severity", severity.trim());
      }

      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/security-timeline?${params.toString()}`,
        {
          headers: getAuthHeaders(),
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to load security timeline (HTTP ${response.status})`);
      }

      const body = (await response.json()) as SecurityTimelineResponseDto;
      setEntries(body.entries);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load security timeline",
      );
    } finally {
      setLoading(false);
    }
  }, [category, severity]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  useEffect(() => {
    const handler = () => {
      void loadTimeline();
    };
    window.addEventListener(ACCESS_GOVERNANCE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(ACCESS_GOVERNANCE_CHANGED_EVENT, handler);
  }, [loadTimeline]);

  return (
    <section id="security-timeline" style={panelStyle}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Security Timeline</h2>
      <p style={{ marginTop: 0, color: "#475569", fontSize: 13 }}>
        Human-readable security and governance events suitable for investigation and
        export.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Category filter"
          style={{ ...inputStyle, minWidth: 180 }}
        />
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
          style={{ ...inputStyle, minWidth: 160 }}
        >
          <option value="">All severities</option>
          <option value="info">info</option>
          <option value="warning">warning</option>
          <option value="critical">critical</option>
        </select>
        <button
          type="button"
          onClick={() => void loadTimeline()}
          style={{
            padding: "0.4rem 0.75rem",
            borderRadius: 6,
            border: "1px solid #64748b",
            background: "#fff",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Refresh
        </button>
      </div>

      {loading ? <p style={{ fontSize: 13 }}>Loading security timeline…</p> : null}
      {error ? (
        <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</p>
      ) : null}

      <div style={{ display: "grid", gap: 8 }}>
        {entries.length === 0 && !loading ? (
          <p style={{ fontSize: 13, color: "#64748b" }}>No security events found.</p>
        ) : null}

        {entries.map((entry) => (
          <article
            key={entry.id}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              padding: "0.75rem",
              background: "#f8fafc",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {new Date(entry.occurredAt).toLocaleString()}
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
                <span style={{ color: severityColor(entry.severity), fontWeight: 700 }}>
                  {entry.severity}
                </span>
                <span style={{ color: "#475569" }}>{entry.category}</span>
              </div>
            </div>
            <div style={{ fontSize: 14, marginTop: 6 }}>{entry.summary}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              Actor: {entry.actorLabel} · Action: {entry.actionType} · Outcome:{" "}
              {entry.outcome}
              {entry.entityId ? ` · Entity: ${entry.entityType}/${entry.entityId}` : ""}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
