"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ActiveConfigurationDto,
  MerchandisingConfigSnapshotDto,
  PromotionHistoryResponseDto,
} from "@retailer-search/shared-types";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

const inputStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
} as const;

const textareaStyle = {
  ...inputStyle,
  minHeight: 72,
  resize: "vertical" as const,
  fontFamily: "inherit",
};

interface PromotePrefillDetail {
  snapshotId: string;
  sourceExperimentId?: string;
  reason?: string;
}

export function PromotionPanel() {
  const [activeConfiguration, setActiveConfiguration] =
    useState<ActiveConfigurationDto | null>(null);
  const [snapshots, setSnapshots] = useState<MerchandisingConfigSnapshotDto[]>(
    [],
  );
  const [history, setHistory] = useState<PromotionHistoryResponseDto>({
    total: 0,
    entries: [],
  });
  const [snapshotId, setSnapshotId] = useState("");
  const [sourceExperimentId, setSourceExperimentId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [requestingApproval, setRequestingApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadPanelData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [activeRes, snapshotsRes, historyRes] = await Promise.all([
        fetch(`${SEARCH_API_URL}/api/v1/admin/active-configuration`, {
          cache: "no-store",
        }),
        fetch(`${SEARCH_API_URL}/api/v1/admin/snapshots`, {
          cache: "no-store",
        }),
        fetch(`${SEARCH_API_URL}/api/v1/admin/promotions`, {
          cache: "no-store",
        }),
      ]);

      if (activeRes.ok) {
        setActiveConfiguration(
          (await activeRes.json()) as ActiveConfigurationDto,
        );
      } else {
        setActiveConfiguration(null);
      }

      if (!snapshotsRes.ok || !historyRes.ok) {
        throw new Error("Failed to load promotion resources");
      }

      const snapshotsData = (await snapshotsRes.json()) as {
        snapshots: MerchandisingConfigSnapshotDto[];
      };
      const historyData =
        (await historyRes.json()) as PromotionHistoryResponseDto;

      setSnapshots(snapshotsData.snapshots);
      setHistory(historyData);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load promotion panel",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPanelData();

    const prefillHandler = (event: Event) => {
      const custom = event as CustomEvent<PromotePrefillDetail>;
      setSnapshotId(custom.detail.snapshotId);
      setSourceExperimentId(custom.detail.sourceExperimentId ?? "");
      setReason(
        custom.detail.reason ??
          "Approved after experiment scorecard and ship decision.",
      );
      setFeedback("Promotion form prefilled from experiment.");
      setError(null);
    };

    const refreshHandler = () => {
      void loadPanelData();
    };

    window.addEventListener("admin:promote-prefill", prefillHandler);
    window.addEventListener("admin:active-config-changed", refreshHandler);
    window.addEventListener("admin:approvals-changed", refreshHandler);
    return () => {
      window.removeEventListener("admin:promote-prefill", prefillHandler);
      window.removeEventListener("admin:active-config-changed", refreshHandler);
      window.removeEventListener("admin:approvals-changed", refreshHandler);
    };
  }, [loadPanelData]);

  const selectedSnapshot = snapshots.find(
    (snapshot) => snapshot.id === snapshotId,
  );

  const submitApprovalRequest = async () => {
    const trimmedReason = reason.trim();
    if (!snapshotId || !trimmedReason) {
      setError("Snapshot and reason are required.");
      return;
    }

    setRequestingApproval(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`${SEARCH_API_URL}/api/v1/admin/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId,
          reason: trimmedReason,
          linkedExperimentId: sourceExperimentId.trim() || undefined,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          body?.error ??
            `Approval request failed with HTTP ${response.status}`,
        );
      }

      setFeedback(
        body?.message ??
          "Approval request created. Approve and execute it before live changes.",
      );
      setReason("");
      setSourceExperimentId("");
      setSnapshotId("");
      window.dispatchEvent(new CustomEvent("admin:approvals-changed"));
    } catch (approvalError) {
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : "Failed to create approval request",
      );
    } finally {
      setRequestingApproval(false);
    }
  };

  const submitPromotion = async () => {
    const trimmedReason = reason.trim();
    if (!snapshotId || !trimmedReason) {
      setError("Snapshot and reason are required.");
      return;
    }

    setPromoting(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/promote-snapshot`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snapshotId,
            reason: trimmedReason,
            sourceExperimentId: sourceExperimentId.trim() || undefined,
          }),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        warning?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          body?.error ?? `Promotion failed with HTTP ${response.status}`,
        );
      }

      setFeedback(body?.message ?? "Snapshot promoted to active configuration.");
      if (body?.warning) {
        setFeedback(`${body.message ?? "Promoted."} (${body.warning})`);
      }

      setConfirmOpen(false);
      setReason("");
      setSourceExperimentId("");
      setSnapshotId("");
      await loadPanelData();
      window.dispatchEvent(new CustomEvent("admin:active-config-changed"));
    } catch (promoteError) {
      setError(
        promoteError instanceof Error
          ? promoteError.message
          : "Failed to promote snapshot",
      );
    } finally {
      setPromoting(false);
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
        Promote snapshot to active configuration
      </h2>

      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Choose an approval-gated release (recommended) or direct promotion for
        emergency bypass. Only execution or direct promotion changes live config.
      </p>

      {loading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Loading promotion state...
        </p>
      )}

      {!loading && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <div
            style={{
              padding: "0.75rem",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              background: "#f8fafc",
              fontSize: 13,
            }}
          >
            <strong>Current active configuration</strong>
            {activeConfiguration ? (
              <div style={{ marginTop: "0.35rem", color: "#475569" }}>
                <div>{activeConfiguration.snapshotName}</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>
                  Promoted{" "}
                  {new Date(activeConfiguration.promotedAt).toLocaleString()} ·{" "}
                  {activeConfiguration.counts.rules} rules ·{" "}
                  {activeConfiguration.counts.synonyms} synonyms
                </div>
              </div>
            ) : (
              <p style={{ margin: "0.35rem 0 0", color: "#94a3b8" }}>
                No snapshot has been promoted yet.
              </p>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              setConfirmOpen(true);
            }}
            style={{
              display: "grid",
              gap: "0.75rem",
              padding: "0.85rem",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              background: "#fff",
            }}
          >
            <strong style={{ fontSize: 14 }}>Promote a snapshot</strong>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
              Recommended: request approval below. Direct promotion bypasses the
              approval gate.
            </p>

            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Snapshot
              <select
                required
                value={snapshotId}
                onChange={(event) => setSnapshotId(event.target.value)}
                style={inputStyle}
              >
                <option value="">Select snapshot</option>
                {snapshots.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {snapshot.name} ({snapshot.counts.rules} rules,{" "}
                    {snapshot.counts.synonyms} synonyms)
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Source experiment id (optional)
              <input
                value={sourceExperimentId}
                onChange={(event) => setSourceExperimentId(event.target.value)}
                placeholder="exp-..."
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Reason
              <textarea
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why is this snapshot safe to promote?"
                style={textareaStyle}
              />
            </label>

            <button
              type="submit"
              disabled={promoting || snapshots.length === 0}
              style={{
                justifySelf: "start",
                padding: "0.55rem 0.9rem",
                border: "none",
                borderRadius: 6,
                background: "#0f172a",
                color: "#fff",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Review direct promotion
            </button>

            <button
              type="button"
              onClick={() => void submitApprovalRequest()}
              disabled={requestingApproval || !snapshotId || !reason.trim()}
              style={{
                justifySelf: "start",
                padding: "0.55rem 0.9rem",
                border: "1px solid #86efac",
                borderRadius: 6,
                background: "#f0fdf4",
                color: "#166534",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {requestingApproval
                ? "Requesting..."
                : "Request approval (recommended)"}
            </button>
          </form>

          {confirmOpen && selectedSnapshot && (
            <div
              style={{
                padding: "0.85rem",
                border: "1px solid #fde68a",
                borderRadius: 8,
                background: "#fffbeb",
                fontSize: 13,
              }}
            >
              <strong>Confirm direct promotion</strong>
              <p style={{ margin: "0.5rem 0", color: "#475569" }}>
                Directly promote <strong>{selectedSnapshot.name}</strong> to live
                without an approval gate? Prefer the approval path when possible.
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => void submitPromotion()}
                  disabled={promoting}
                  style={{
                    padding: "0.45rem 0.75rem",
                    border: "none",
                    borderRadius: 6,
                    background: "#15803d",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {promoting ? "Promoting..." : "Confirm promote"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={promoting}
                  style={{
                    padding: "0.45rem 0.75rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {feedback && (
            <p style={{ margin: 0, color: "#15803d", fontSize: 13 }}>
              {feedback}
            </p>
          )}
          {error && (
            <p style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>
              {error}
            </p>
          )}

          <div>
            <strong style={{ fontSize: 14 }}>Recent promotion history</strong>
            {history.entries.length === 0 ? (
              <p style={{ margin: "0.5rem 0 0", color: "#94a3b8", fontSize: 13 }}>
                No promotions recorded yet.
              </p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  margin: "0.5rem 0 0",
                  padding: 0,
                  display: "grid",
                  gap: "0.5rem",
                }}
              >
                {history.entries.slice(0, 5).map((entry) => (
                  <li
                    key={entry.id}
                    style={{
                      padding: "0.65rem 0.75rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  >
                    <strong>{entry.snapshotName}</strong>
                    <p style={{ margin: "0.25rem 0", color: "#475569" }}>
                      {entry.reason}
                    </p>
                    <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>
                      {new Date(entry.promotedAt).toLocaleString()}
                      {entry.sourceExperimentId &&
                        ` · experiment ${entry.sourceExperimentId}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
