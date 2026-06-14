"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type {
  MerchandisingConfigSnapshotDto,
  ReviewerListResponseDto,
  SnapshotListResponseDto,
} from "@retailer-search/shared-types";
import { AnnotationPanel } from "./annotation-panel";
import { CommentsPanel } from "./comments-panel";
import { SnapshotDiffPreview } from "./snapshot-diff-preview";
import { notifySnapshotsChanged } from "./snapshot-events";
import { ADMIN_REVIEWER_STORAGE_KEY } from "./admin/approvals/components/reviewer-management-panel";

const inputStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
} as const;

export function SnapshotsPanel() {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<MerchandisingConfigSnapshotDto[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [fromSnapshotId, setFromSnapshotId] = useState("");
  const [toSnapshotId, setToSnapshotId] = useState("");
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [openCollaborationBySnapshot, setOpenCollaborationBySnapshot] = useState<
    Record<string, boolean>
  >({});
  const [actorId, setActorId] = useState("local-requester");
  const [actorLabel, setActorLabel] = useState("Local Requester");

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/snapshots`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to load snapshots: HTTP ${response.status}`);
      }

      const data = (await response.json()) as SnapshotListResponseDto;
      setSnapshots(data.snapshots);
    } catch (loadError) {
      setSnapshots([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load snapshots",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  useEffect(() => {
    const loadActor = async () => {
      try {
        const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/reviewers`, {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as ReviewerListResponseDto;
        const storedActorId = window.localStorage.getItem(ADMIN_REVIEWER_STORAGE_KEY);
        const reviewer =
          body.reviewers.find(
            (entry) => entry.id === storedActorId && entry.active,
          ) ?? body.reviewers.find((entry) => entry.active);

        if (reviewer) {
          setActorId(reviewer.id);
          setActorLabel(reviewer.name);
        }
      } catch {
        // keep defaults
      }
    };

    void loadActor();
  }, []);

  const createSnapshot = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    setCreating(true);
    setFeedback(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Create snapshot failed with HTTP ${response.status}`);
      }

      setName("");
      setDescription("");
      setFeedback("Snapshot created.");
      await loadSnapshots();
      notifySnapshotsChanged();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create snapshot",
      );
    } finally {
      setCreating(false);
    }
  };

  const rollbackSnapshot = async (snapshot: MerchandisingConfigSnapshotDto) => {
    const confirmed = window.confirm(
      `Rollback live merchandising configuration to '${snapshot.name}'? This replaces current rules and synonyms in memory.`,
    );
    if (!confirmed) {
      return;
    }

    setRollingBackId(snapshot.id);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/snapshots/rollback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshotId: snapshot.id }),
        },
      );

      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.message || `Rollback failed with HTTP ${response.status}`);
      }

      setFeedback(result.message ?? "Rollback completed.");
      router.refresh();
    } catch (rollbackError) {
      setError(
        rollbackError instanceof Error
          ? rollbackError.message
          : "Rollback failed",
      );
    } finally {
      setRollingBackId(null);
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
        Configuration snapshots
      </h2>

      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Capture point-in-time copies of merchandising rules and synonyms.
        Rollback restores live config without deleting snapshot history.
      </p>

      <form
        onSubmit={(event) => void createSnapshot(event)}
        style={{
          display: "grid",
          gap: "0.65rem",
          marginBottom: "1rem",
          padding: "0.85rem",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#f8fafc",
        }}
      >
        <strong style={{ fontSize: 14 }}>Create snapshot</strong>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Before drill ranking experiment"
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Description (optional)
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Stable baseline before merchandising changes"
            style={inputStyle}
          />
        </label>
        <button
          type="submit"
          disabled={creating}
          style={{
            justifySelf: "start",
            padding: "0.55rem 0.9rem",
            border: "none",
            borderRadius: 6,
            background: "var(--forge-primary)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          {creating ? "Saving..." : "Save snapshot"}
        </button>
      </form>

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

      {error && (
        <p style={{ margin: "0 0 1rem", color: "#b91c1c", fontSize: 14 }}>
          {error}
        </p>
      )}

      {loading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Loading snapshots...
        </p>
      )}

      {!loading && snapshots.length === 0 && (
        <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
          No snapshots yet. Save one before making risky merchandising changes.
        </p>
      )}

      {!loading && snapshots.length > 0 && (
        <>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: "0.65rem",
            }}
          >
            {snapshots.map((snapshot) => (
              <li
                key={snapshot.id}
                style={{
                  padding: "0.75rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                    marginBottom: "0.35rem",
                  }}
                >
                  <strong>{snapshot.name}</strong>
                  <span style={{ color: "#64748b" }}>
                    {new Date(snapshot.createdAt).toLocaleString()}
                  </span>
                </div>

                {snapshot.description && (
                  <p style={{ margin: "0 0 0.35rem", color: "#475569" }}>
                    {snapshot.description}
                  </p>
                )}

                <p style={{ margin: "0 0 0.5rem", color: "#64748b" }}>
                  {snapshot.counts.rules} rules · {snapshot.counts.synonyms}{" "}
                  synonyms · {snapshot.createdBy.actorLabel}
                </p>

                <button
                  type="button"
                  onClick={() => void rollbackSnapshot(snapshot)}
                  disabled={rollingBackId === snapshot.id}
                  style={{
                    padding: "0.4rem 0.7rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {rollingBackId === snapshot.id ? "Rolling back..." : "Rollback"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setOpenCollaborationBySnapshot((current) => ({
                      ...current,
                      [snapshot.id]: !current[snapshot.id],
                    }))
                  }
                  style={{
                    marginLeft: "0.5rem",
                    padding: "0.4rem 0.7rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {openCollaborationBySnapshot[snapshot.id]
                    ? "Hide notes"
                    : "Review notes"}
                </button>

                {openCollaborationBySnapshot[snapshot.id] && (
                  <>
                    <CommentsPanel
                      targetType="snapshot"
                      targetId={snapshot.id}
                      actorId={actorId}
                      actorLabel={actorLabel}
                      title="Snapshot comments"
                    />
                    <AnnotationPanel
                      targetType="snapshot"
                      targetId={snapshot.id}
                      actorId={actorId}
                      actorLabel={actorLabel}
                      title="Snapshot annotations"
                      defaultAnchorLabel="snapshot baseline"
                    />
                  </>
                )}
              </li>
            ))}
          </ul>

          <div
            style={{
              marginTop: "1rem",
              paddingTop: "1rem",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <strong style={{ fontSize: 14 }}>Compare snapshots</strong>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "0.75rem",
                marginTop: "0.75rem",
              }}
            >
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                From
                <select
                  value={fromSnapshotId}
                  onChange={(event) => setFromSnapshotId(event.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select snapshot</option>
                  {snapshots.map((snapshot) => (
                    <option key={`from-${snapshot.id}`} value={snapshot.id}>
                      {snapshot.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                To
                <select
                  value={toSnapshotId}
                  onChange={(event) => setToSnapshotId(event.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select snapshot</option>
                  {snapshots.map((snapshot) => (
                    <option key={`to-${snapshot.id}`} value={snapshot.id}>
                      {snapshot.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {fromSnapshotId && toSnapshotId && (
              <SnapshotDiffPreview
                fromSnapshotId={fromSnapshotId}
                toSnapshotId={toSnapshotId}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
