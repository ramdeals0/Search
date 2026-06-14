"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScheduledReleaseDto } from "@retailer-search/shared-types";
import { getSearchApiUrl } from "./lib/search-api-url";
import { getAuthHeaders } from "./lib/auth-headers";

const panelStyle = {
  padding: "1rem",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#fff",
} as const;

const buttonStyle = {
  padding: "0.4rem 0.7rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
} as const;

function formatType(type: ScheduledReleaseDto["type"]): string {
  return type === "promote_snapshot" ? "Promote" : "Rollback";
}

export function ScheduledReleasesPanel() {
  const [releases, setReleases] = useState<ScheduledReleaseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReleases = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/scheduled-releases`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: getAuthHeaders("none"),
      });
      if (!response.ok) {
        throw new Error(`Failed to load scheduled releases (${response.status})`);
      }
      const body = (await response.json()) as { releases: ScheduledReleaseDto[] };
      setReleases(body.releases ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReleases();
  }, [loadReleases]);

  useEffect(() => {
    const handler = () => {
      void loadReleases();
    };
    window.addEventListener("admin:scheduled-releases-changed", handler);
    return () => window.removeEventListener("admin:scheduled-releases-changed", handler);
  }, [loadReleases]);

  const cancelRelease = async (id: string) => {
    setError(null);
    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/scheduled-releases/${id}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: getAuthHeaders("none"),
        },
      );
      if (!response.ok) {
        throw new Error(`Cancel failed (${response.status})`);
      }
      await loadReleases();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Cancel failed");
    }
  };

  const upcoming = releases.filter((release) => release.status === "pending");

  return (
    <section style={panelStyle}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>Scheduled releases</h2>
      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Upcoming promote and rollback jobs executed by the search-api scheduler every minute.
      </p>

      {error ? (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 14 }}>{error}</p>
      ) : null}

      {loading ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Loading schedule...</p>
      ) : upcoming.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          No pending scheduled releases.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "0.5rem" }}>When</th>
                <th style={{ padding: "0.5rem" }}>Type</th>
                <th style={{ padding: "0.5rem" }}>Snapshot</th>
                <th style={{ padding: "0.5rem" }}>Reason</th>
                <th style={{ padding: "0.5rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((release) => (
                <tr key={release.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.5rem" }}>
                    {new Date(release.scheduledAt).toLocaleString()}
                  </td>
                  <td style={{ padding: "0.5rem" }}>{formatType(release.type)}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <code>{release.snapshotId}</code>
                  </td>
                  <td style={{ padding: "0.5rem", color: "#475569" }}>{release.reason}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <button
                      type="button"
                      style={buttonStyle}
                      onClick={() => void cancelRelease(release.id)}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {releases.some((release) => release.status !== "pending") ? (
        <div style={{ marginTop: "1rem" }}>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>Recent history</h3>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: 13, color: "#64748b" }}>
            {releases
              .filter((release) => release.status !== "pending")
              .slice(0, 5)
              .map((release) => (
                <li key={release.id}>
                  {formatType(release.type)} · {release.status} ·{" "}
                  {new Date(release.scheduledAt).toLocaleString()}
                  {release.errorMessage ? ` — ${release.errorMessage}` : ""}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
