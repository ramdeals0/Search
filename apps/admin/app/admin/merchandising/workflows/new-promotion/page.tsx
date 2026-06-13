"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ActiveConfigurationDto,
  MerchandisingConfigSnapshotDto,
} from "@retailer-search/shared-types";
import {
  WorkflowShell,
  workflowButtonStyle,
  workflowInputStyle,
} from "../../../admin-page-header";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

const STEPS = [
  "Campaign basics",
  "Targeting",
  "Products/content",
  "Schedule",
  "Review",
  "Launch",
] as const;

export default function NewPromotionWorkflowPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [snapshots, setSnapshots] = useState<MerchandisingConfigSnapshotDto[]>([]);
  const [activeConfiguration, setActiveConfiguration] =
    useState<ActiveConfigurationDto | null>(null);
  const [snapshotId, setSnapshotId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [reason, setReason] = useState("");
  const [sourceExperimentId, setSourceExperimentId] = useState("");
  const [launchMode, setLaunchMode] = useState<"approval" | "direct">("approval");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [activeRes, snapshotsRes] = await Promise.all([
        fetch(`${SEARCH_API_URL}/api/v1/admin/active-configuration`, {
          cache: "no-store",
        }),
        fetch(`${SEARCH_API_URL}/api/v1/admin/snapshots`, { cache: "no-store" }),
      ]);

      if (activeRes.ok) {
        setActiveConfiguration((await activeRes.json()) as ActiveConfigurationDto);
      } else {
        setActiveConfiguration(null);
      }

      if (snapshotsRes.ok) {
        const payload = (await snapshotsRes.json()) as {
          snapshots: MerchandisingConfigSnapshotDto[];
        };
        const nextSnapshots = payload.snapshots ?? [];
        setSnapshots(nextSnapshots);
        setSnapshotId((current) => current || nextSnapshots[0]?.id || "");
      } else {
        setSnapshots([]);
        throw new Error(`Failed to load snapshots: HTTP ${snapshotsRes.status}`);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedSnapshot = snapshots.find((snapshot) => snapshot.id === snapshotId);

  const canAdvance = useMemo(() => {
    if (step === 1) {
      return campaignName.trim().length > 0 && reason.trim().length > 0;
    }
    if (step === 2) {
      return Boolean(snapshotId);
    }
    return true;
  }, [campaignName, reason, snapshotId, step]);

  const submitApprovalRequest = async () => {
    setSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`${SEARCH_API_URL}/api/v1/admin/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId,
          reason: `[${campaignName.trim()}] ${reason.trim()}`,
          linkedExperimentId: sourceExperimentId.trim() || undefined,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          body?.error ?? `Approval request failed with HTTP ${response.status}`,
        );
      }

      setFeedback(body?.message ?? "Approval request created.");
      window.dispatchEvent(new CustomEvent("admin:approvals-changed"));
      window.setTimeout(() => {
        router.push("/admin/approvals");
      }, 900);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const submitPromotion = async () => {
    setSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`${SEARCH_API_URL}/api/v1/admin/promote-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId,
          reason: `[${campaignName.trim()}] ${reason.trim()}`,
          sourceExperimentId: sourceExperimentId.trim() || undefined,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        warning?: string;
      } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? `Promotion failed with HTTP ${response.status}`);
      }

      setFeedback(
        body?.warning
          ? `${body.message ?? "Promoted."} (${body.warning})`
          : (body?.message ?? "Snapshot promoted to active configuration."),
      );
      window.dispatchEvent(new CustomEvent("admin:active-config-changed"));
      window.setTimeout(() => {
        router.push("/admin/merchandising/promotions");
        router.refresh();
      }, 900);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Promotion failed");
    } finally {
      setSubmitting(false);
    }
  };

  const stepContent = (() => {
    if (loading) {
      return (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Loading snapshots and active configuration...
        </p>
      );
    }

    switch (step) {
      case 1:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Describe the promotion campaign and why it should go live.
            </p>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Campaign name
              <input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                style={workflowInputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Business reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                style={{ ...workflowInputStyle, minHeight: 72, resize: "vertical" }}
              />
            </label>
          </div>
        );
      case 2:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Select the snapshot to promote and optional experiment linkage.
            </p>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Snapshot
              <select
                value={snapshotId}
                onChange={(event) => setSnapshotId(event.target.value)}
                style={workflowInputStyle}
              >
                {snapshots.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {snapshot.name} ({snapshot.counts?.rules ?? 0} rules)
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Source experiment ID (optional)
              <input
                value={sourceExperimentId}
                onChange={(event) => setSourceExperimentId(event.target.value)}
                style={workflowInputStyle}
              />
            </label>
            {snapshots.length === 0 ? (
              <p style={{ margin: 0, color: "#b45309", fontSize: 14 }}>
                No snapshots available. Capture one from the Snapshots workspace first.
              </p>
            ) : null}
          </div>
        );
      case 3:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Content included in the selected snapshot.
            </p>
            {selectedSnapshot ? (
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  fontSize: 13,
                }}
              >
                <strong>{selectedSnapshot.name}</strong>
                <div style={{ marginTop: 6, color: "#64748b" }}>
                  {selectedSnapshot.counts?.rules ?? 0} rules ·{" "}
                  {selectedSnapshot.counts?.synonyms ?? 0} synonyms
                </div>
                <div style={{ marginTop: 6, color: "#64748b" }}>
                  Captured {new Date(selectedSnapshot.createdAt).toLocaleString()}
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
                Select a snapshot in the previous step.
              </p>
            )}
            {activeConfiguration ? (
              <div style={{ fontSize: 13, color: "#475569" }}>
                Current live config: {activeConfiguration.snapshotName} (
                {activeConfiguration.counts.rules} rules)
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#64748b" }}>
                No active live configuration promoted yet.
              </div>
            )}
          </div>
        );
      case 4:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Choose how this promotion should launch. Approval-gated release is recommended.
            </p>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Launch mode
              <select
                value={launchMode}
                onChange={(event) =>
                  setLaunchMode(event.target.value as "approval" | "direct")
                }
                style={workflowInputStyle}
              >
                <option value="approval">Request approval (recommended)</option>
                <option value="direct">Direct promote (emergency bypass)</option>
              </select>
            </label>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              {launchMode === "approval"
                ? "Creates an approval request. Live search changes only after execution in Approvals."
                : "Promotes immediately to active configuration without waiting for approval execution."}
            </p>
          </div>
        );
      case 5:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Confirm promotion details before launch.
            </p>
            <pre
              style={{
                margin: 0,
                padding: "0.75rem",
                borderRadius: 8,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}
            >
              {[
                `Campaign: ${campaignName}`,
                `Reason: ${reason}`,
                `Snapshot: ${selectedSnapshot?.name ?? snapshotId}`,
                `Experiment: ${sourceExperimentId.trim() || "—"}`,
                `Launch mode: ${launchMode === "approval" ? "Approval request" : "Direct promote"}`,
              ].join("\n")}
            </pre>
          </div>
        );
      case 6:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Launch the promotion using your selected mode.
            </p>
            {error ? (
              <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p>
            ) : null}
            {feedback ? (
              <p style={{ margin: 0, color: "#15803d", fontSize: 14 }}>{feedback}</p>
            ) : null}
            <button
              type="button"
              disabled={submitting || Boolean(feedback) || !snapshotId}
              onClick={() =>
                void (launchMode === "approval"
                  ? submitApprovalRequest()
                  : submitPromotion())
              }
              style={workflowButtonStyle("primary")}
            >
              {submitting
                ? "Submitting..."
                : launchMode === "approval"
                  ? "Request approval"
                  : "Promote snapshot"}
            </button>
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <WorkflowShell
      title="New promotion"
      description="Guided snapshot promotion with targeting, review, and controlled launch."
      backHref="/admin/merchandising/promotions"
      backLabel="← Promotions workspace"
      steps={STEPS}
      currentStep={step}
      footer={
        <>
          <button
            type="button"
            disabled={step === 1 || loading}
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            style={workflowButtonStyle("secondary")}
          >
            Back
          </button>
          {step < STEPS.length ? (
            <button
              type="button"
              disabled={!canAdvance || loading}
              onClick={() => setStep((current) => Math.min(STEPS.length, current + 1))}
              style={workflowButtonStyle("primary")}
            >
              Continue
            </button>
          ) : null}
        </>
      }
    >
      {stepContent}
    </WorkflowShell>
  );
}
