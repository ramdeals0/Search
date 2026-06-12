"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ApprovalAssignmentHistoryResponseDto,
  ApprovalEligibilityResponseDto,
  ApprovalListResponseDto,
  ApprovalRequestDto,
  ApprovalSlaOverviewDto,
  ApprovalSlaStatusDto,
  ApprovalStatus,
  MerchandisingConfigSnapshotDto,
  ReviewerDto,
  ReviewerListResponseDto,
} from "@retailer-search/shared-types";
import {
  ADMIN_REVIEWER_CHANGED_EVENT,
  ADMIN_REVIEWER_STORAGE_KEY,
} from "./reviewer-management-panel";
import { AnnotationPanel } from "./annotation-panel";
import { CommentsPanel } from "./comments-panel";

const ADMIN_NOTIFICATIONS_CHANGED_EVENT = "admin:notifications-changed";
const ADMIN_DELEGATION_CHANGED_EVENT = "admin:delegation-changed";
const ADMIN_EXCEPTIONS_CHANGED_EVENT = "admin:exceptions-changed";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

export const ADMIN_APPROVALS_CHANGED_EVENT = "admin:approvals-changed";

const STATUS_COLORS: Record<ApprovalStatus, string> = {
  pending: "#b45309",
  approved: "#15803d",
  rejected: "#b91c1c",
  executed: "#0f766e",
  cancelled: "#64748b",
};

const SLA_STATUS_COLORS: Record<ApprovalSlaStatusDto["status"], string> = {
  on_track: "#15803d",
  due_soon: "#b45309",
  overdue: "#b91c1c",
  completed: "#64748b",
};

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

function getApprovalProgress(request: ApprovalRequestDto): string {
  const approvedCount = (request.decisions ?? []).filter(
    (decision) => decision.decision === "approved",
  ).length;
  const distinctApprovers = new Set(
    (request.decisions ?? [])
      .filter((decision) => decision.decision === "approved")
      .map((decision) => decision.actorId),
  ).size;
  const required = request.requiredApprovalCount ?? 1;
  return `${distinctApprovers}/${required} approvals`;
}

export function ApprovalPanel() {
  const [requests, setRequests] = useState<ApprovalRequestDto[]>([]);
  const [snapshots, setSnapshots] = useState<MerchandisingConfigSnapshotDto[]>(
    [],
  );
  const [reviewers, setReviewers] = useState<ReviewerDto[]>([]);
  const [actorId, setActorId] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [linkedExperimentId, setLinkedExperimentId] = useState("");
  const [reason, setReason] = useState("");
  const [assignSelections, setAssignSelections] = useState<
    Record<string, string[]>
  >({});
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>(
    {},
  );
  const [eligibilityByRequest, setEligibilityByRequest] = useState<
    Record<string, ApprovalEligibilityResponseDto>
  >({});
  const [slaByRequestId, setSlaByRequestId] = useState<
    Record<string, ApprovalSlaStatusDto>
  >({});
  const [assignmentHistoryByRequest, setAssignmentHistoryByRequest] = useState<
    Record<string, ApprovalAssignmentHistoryResponseDto>
  >({});
  const [reassignSelections, setReassignSelections] = useState<
    Record<string, string[]>
  >({});
  const [reassignReasons, setReassignReasons] = useState<Record<string, string>>(
    {},
  );
  const [openCollaborationByRequest, setOpenCollaborationByRequest] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadEligibility = useCallback(
    async (requestList: ApprovalRequestDto[], currentActorId: string) => {
      if (!currentActorId) {
        setEligibilityByRequest({});
        return;
      }

      const entries = await Promise.all(
        requestList.map(async (request) => {
          const response = await fetch(
            `${SEARCH_API_URL}/api/v1/admin/approvals/${request.id}/eligibility?actorId=${encodeURIComponent(currentActorId)}`,
            { cache: "no-store" },
          );

          if (!response.ok) {
            return [request.id, { canApprove: false, canExecute: false, reasons: [] }] as const;
          }

          const body = (await response.json()) as ApprovalEligibilityResponseDto;
          return [request.id, body] as const;
        }),
      );

      setEligibilityByRequest(Object.fromEntries(entries));
    },
    [],
  );

  const loadAssignmentHistory = useCallback(
    async (requestList: ApprovalRequestDto[]) => {
      const entries = await Promise.all(
        requestList.map(async (request) => {
          const response = await fetch(
            `${SEARCH_API_URL}/api/v1/admin/approvals/${request.id}/assignment-history`,
            { cache: "no-store" },
          );

          if (!response.ok) {
            return null;
          }

          const body =
            (await response.json()) as ApprovalAssignmentHistoryResponseDto;
          return [request.id, body] as const;
        }),
      );

      setAssignmentHistoryByRequest(
        Object.fromEntries(entries.filter((entry): entry is readonly [string, ApprovalAssignmentHistoryResponseDto] => entry !== null)),
      );
    },
    [],
  );

  const loadPanelData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [approvalsRes, snapshotsRes, reviewersRes, slaRes] = await Promise.all([
        fetch(`${SEARCH_API_URL}/api/v1/admin/approvals`, { cache: "no-store" }),
        fetch(`${SEARCH_API_URL}/api/v1/admin/snapshots`, { cache: "no-store" }),
        fetch(`${SEARCH_API_URL}/api/v1/admin/reviewers`, { cache: "no-store" }),
        fetch(`${SEARCH_API_URL}/api/v1/admin/approval-sla`, { cache: "no-store" }),
      ]);

      if (!approvalsRes.ok || !snapshotsRes.ok || !reviewersRes.ok || !slaRes.ok) {
        throw new Error("Failed to load approval resources");
      }

      const approvalsData = (await approvalsRes.json()) as ApprovalListResponseDto;
      const snapshotsData = (await snapshotsRes.json()) as {
        snapshots: MerchandisingConfigSnapshotDto[];
      };
      const reviewersData = (await reviewersRes.json()) as ReviewerListResponseDto;
      const slaData = (await slaRes.json()) as ApprovalSlaOverviewDto;

      setRequests(approvalsData.requests);
      setSnapshots(snapshotsData.snapshots);
      setReviewers(reviewersData.reviewers);
      setSlaByRequestId(
        Object.fromEntries(
          slaData.items.map((item) => [item.approvalRequestId, item]),
        ),
      );

      const storedActorId = window.localStorage.getItem(ADMIN_REVIEWER_STORAGE_KEY);
      const currentActorId =
        storedActorId &&
        reviewersData.reviewers.some(
          (reviewer) => reviewer.id === storedActorId && reviewer.active,
        )
          ? storedActorId
          : (reviewersData.reviewers.find((reviewer) => reviewer.active)?.id ??
            "");
      setActorId(currentActorId);
      await loadEligibility(approvalsData.requests, currentActorId);
      await loadAssignmentHistory(approvalsData.requests);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load approval panel",
      );
    } finally {
      setLoading(false);
    }
  }, [loadEligibility, loadAssignmentHistory]);

  useEffect(() => {
    void loadPanelData();

    const handler = () => {
      void loadPanelData();
    };

    window.addEventListener(ADMIN_APPROVALS_CHANGED_EVENT, handler);
    window.addEventListener(ADMIN_REVIEWER_CHANGED_EVENT, handler);
    window.addEventListener(ADMIN_NOTIFICATIONS_CHANGED_EVENT, handler);
    window.addEventListener(ADMIN_DELEGATION_CHANGED_EVENT, handler);
    window.addEventListener(ADMIN_EXCEPTIONS_CHANGED_EVENT, handler);
    window.addEventListener("admin:promote-prefill", handler);
    return () => {
      window.removeEventListener(ADMIN_APPROVALS_CHANGED_EVENT, handler);
      window.removeEventListener(ADMIN_REVIEWER_CHANGED_EVENT, handler);
      window.removeEventListener(ADMIN_NOTIFICATIONS_CHANGED_EVENT, handler);
      window.removeEventListener(ADMIN_DELEGATION_CHANGED_EVENT, handler);
      window.removeEventListener(ADMIN_EXCEPTIONS_CHANGED_EVENT, handler);
      window.removeEventListener("admin:promote-prefill", handler);
    };
  }, [loadPanelData]);

  useEffect(() => {
    const prefillHandler = (event: Event) => {
      const custom = event as CustomEvent<{
        snapshotId: string;
        sourceExperimentId?: string;
        reason?: string;
      }>;
      setSnapshotId(custom.detail.snapshotId);
      setLinkedExperimentId(custom.detail.sourceExperimentId ?? "");
      setReason(
        custom.detail.reason ??
          "Release candidate approved after experiment scorecard.",
      );
    };

    window.addEventListener("admin:promote-prefill", prefillHandler);
    return () =>
      window.removeEventListener("admin:promote-prefill", prefillHandler);
  }, []);

  const notifyChanged = () => {
    window.dispatchEvent(new CustomEvent(ADMIN_APPROVALS_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent(ADMIN_NOTIFICATIONS_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent(ADMIN_EXCEPTIONS_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent("admin:active-config-changed"));
  };

  const reviewerLabel = (reviewerId: string) => {
    const reviewer = reviewers.find((entry) => entry.id === reviewerId);
    return reviewer ? `${reviewer.name} (${reviewer.id})` : reviewerId;
  };

  const createRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!snapshotId || !trimmedReason) {
      setError("Snapshot and reason are required.");
      return;
    }

    setCreating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`${SEARCH_API_URL}/api/v1/admin/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId,
          reason: trimmedReason,
          linkedExperimentId: linkedExperimentId.trim() || undefined,
          actorId: actorId || undefined,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          body?.error ?? `Create approval failed with HTTP ${response.status}`,
        );
      }

      setFeedback(body?.message ?? "Approval request created.");
      setReason("");
      setLinkedExperimentId("");
      setSnapshotId("");
      await loadPanelData();
      notifyChanged();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create approval request",
      );
    } finally {
      setCreating(false);
    }
  };

  const assignReviewers = async (requestId: string) => {
    const reviewerIds = assignSelections[requestId] ?? [];
    if (reviewerIds.length === 0) {
      setError("Select at least one reviewer to assign.");
      return;
    }

    setActingOnId(requestId);
    setError(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/approvals/${requestId}/assign-reviewers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewerIds }),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          body?.error ?? `Assign reviewers failed with HTTP ${response.status}`,
        );
      }

      setFeedback(body?.message ?? "Reviewers assigned.");
      await loadPanelData();
      notifyChanged();
    } catch (assignError) {
      setError(
        assignError instanceof Error
          ? assignError.message
          : "Failed to assign reviewers",
      );
    } finally {
      setActingOnId(null);
    }
  };

  const reassignRequest = async (requestId: string) => {
    const nextReviewerIds = reassignSelections[requestId] ?? [];
    const reassignReason = (reassignReasons[requestId] ?? "").trim();

    if (nextReviewerIds.length === 0) {
      setError("Select at least one reviewer for reassignment.");
      return;
    }

    if (!reassignReason) {
      setError("Reassignment reason is required.");
      return;
    }

    setActingOnId(requestId);
    setError(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/approvals/${requestId}/reassign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nextReviewerIds, reason: reassignReason }),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          body?.error ?? `Reassign failed with HTTP ${response.status}`,
        );
      }

      setFeedback(body?.message ?? "Approval reassigned.");
      setReassignReasons((current) => ({ ...current, [requestId]: "" }));
      await loadPanelData();
      notifyChanged();
    } catch (reassignError) {
      setError(
        reassignError instanceof Error
          ? reassignError.message
          : "Failed to reassign approval",
      );
    } finally {
      setActingOnId(null);
    }
  };

  const resolveRequest = async (
    requestId: string,
    decision: "approved" | "rejected" | "cancelled",
  ) => {
    if (!actorId && decision !== "cancelled") {
      setError("Select an active reviewer context first.");
      return;
    }

    setActingOnId(requestId);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/approvals/${requestId}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            decisionNote: decisionNotes[requestId]?.trim() || undefined,
            actorId: actorId || undefined,
          }),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          body?.error ?? `Resolve failed with HTTP ${response.status}`,
        );
      }

      setFeedback(body?.message ?? `Request ${decision}.`);
      await loadPanelData();
      notifyChanged();
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "Failed to resolve approval request",
      );
    } finally {
      setActingOnId(null);
    }
  };

  const executeRequest = async (request: ApprovalRequestDto) => {
    if (!actorId) {
      setError("Select an active reviewer context first.");
      return;
    }

    if (
      !window.confirm(
        `Execute approved release for '${request.snapshotName ?? request.snapshotId}' as ${actorId}?`,
      )
    ) {
      return;
    }

    setActingOnId(request.id);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/approvals/${request.id}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actorId }),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        reasons?: string[];
      } | null;

      if (!response.ok) {
        throw new Error(
          body?.error ?? body?.reasons?.[0] ?? `Execute failed with HTTP ${response.status}`,
        );
      }

      setFeedback(body?.message ?? "Approved release executed.");
      await loadPanelData();
      notifyChanged();
    } catch (executeError) {
      setError(
        executeError instanceof Error
          ? executeError.message
          : "Failed to execute approval request",
      );
    } finally {
      setActingOnId(null);
    }
  };

  const activeReviewer = reviewers.find((reviewer) => reviewer.id === actorId);

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
        Release approval gates
      </h2>

      <p style={{ margin: "0 0 0.75rem", fontSize: 13, color: "#64748b" }}>
        Two-person approval: record decisions from distinct reviewers, then execute
        with a separate release manager when policy requires it.
      </p>

      <p style={{ margin: "0 0 1rem", fontSize: 12, color: "#475569" }}>
        Active reviewer context:{" "}
        {activeReviewer
          ? `${activeReviewer.name} (${activeReviewer.role})`
          : "none selected"}
      </p>

      <form
        onSubmit={(event) => void createRequest(event)}
        style={{
          display: "grid",
          gap: "0.75rem",
          marginBottom: "1rem",
          padding: "0.85rem",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#f8fafc",
        }}
      >
        <strong style={{ fontSize: 14 }}>Create approval request</strong>

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
                {snapshot.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Linked experiment id (optional)
          <input
            value={linkedExperimentId}
            onChange={(event) => setLinkedExperimentId(event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Reason
          <textarea
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why should this snapshot be promoted to live?"
            style={textareaStyle}
          />
        </label>

        <button
          type="submit"
          disabled={creating || snapshots.length === 0}
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
          {creating ? "Creating..." : "Create approval request"}
        </button>
      </form>

      {feedback && (
        <p style={{ margin: "0 0 0.75rem", color: "#15803d", fontSize: 13 }}>
          {feedback}
        </p>
      )}
      {error && (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 13 }}>
          {error}
        </p>
      )}

      {loading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Loading approval requests...
        </p>
      )}

      {!loading && requests.length === 0 && (
        <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
          No approval requests yet.
        </p>
      )}

      {!loading && requests.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: "0.65rem",
          }}
        >
          {requests.map((request) => {
            const eligibility = eligibilityByRequest[request.id];
            const sla = slaByRequestId[request.id];
            const assignment = assignmentHistoryByRequest[request.id];
            return (
              <li
                key={request.id}
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
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    alignItems: "center",
                    marginBottom: "0.35rem",
                  }}
                >
                  <strong>{request.snapshotName ?? request.snapshotId}</strong>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: STATUS_COLORS[request.status],
                    }}
                  >
                    {request.status}
                  </span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    {getApprovalProgress(request)}
                  </span>
                  {request.status === "pending" && sla && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: SLA_STATUS_COLORS[sla.status],
                        padding: "0.1rem 0.35rem",
                        border: `1px solid ${SLA_STATUS_COLORS[sla.status]}`,
                        borderRadius: 4,
                      }}
                    >
                      SLA {sla.status.replace("_", " ")}
                      {sla.overdue ? " · overdue" : sla.reminderDue ? " · reminder" : ""}
                    </span>
                  )}
                </div>

                <p style={{ margin: "0 0 0.35rem", color: "#475569" }}>
                  {request.reason}
                </p>
                <p style={{ margin: "0 0 0.35rem", color: "#64748b", fontSize: 12 }}>
                  Requested by {request.requestedBy.actorLabel} ·{" "}
                  {new Date(request.createdAt).toLocaleString()}
                  {sla && request.status === "pending"
                    ? ` · ${sla.ageHours}h open`
                    : ""}
                </p>

                {(request.decisions ?? []).length > 0 && (
                  <ul
                    style={{
                      margin: "0 0 0.35rem",
                      paddingLeft: "1.1rem",
                      color: "#64748b",
                      fontSize: 12,
                    }}
                  >
                    {(request.decisions ?? []).map((decision, index) => (
                      <li key={`${decision.actorId}-${index}`}>
                        {decision.actorLabel} {decision.decision}
                        {decision.note ? ` — ${decision.note}` : ""}
                      </li>
                    ))}
                  </ul>
                )}

                {assignment && (
                  <div
                    style={{
                      margin: "0 0 0.35rem",
                      padding: "0.55rem",
                      borderRadius: 6,
                      background: "#f8fafc",
                      fontSize: 12,
                      color: "#475569",
                    }}
                  >
                    <p style={{ margin: "0 0 0.25rem" }}>
                      <strong>Assigned reviewers:</strong>{" "}
                      {assignment.assignedReviewerIds.length > 0
                        ? assignment.assignedReviewerIds.map(reviewerLabel).join(", ")
                        : "none"}
                    </p>
                    <p style={{ margin: "0 0 0.25rem" }}>
                      <strong>Effective reviewers:</strong>{" "}
                      {assignment.effectiveReviewerIds.map(reviewerLabel).join(", ")}
                    </p>
                    {assignment.delegatedReviewerIds.length > 0 && (
                      <p style={{ margin: "0 0 0.25rem", color: "#1d4ed8" }}>
                        <strong>Delegated backup:</strong>{" "}
                        {assignment.delegatedReviewerIds.map(reviewerLabel).join(", ")}
                      </p>
                    )}
                  </div>
                )}

                {assignment && assignment.changes.length > 0 && (
                  <details style={{ margin: "0 0 0.35rem", fontSize: 12, color: "#64748b" }}>
                    <summary style={{ cursor: "pointer" }}>
                      Assignment history ({assignment.total})
                    </summary>
                    <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1.1rem" }}>
                      {assignment.changes.map((change, index) => (
                        <li key={`${change.changedAt}-${index}`}>
                          {change.changeType}: {change.previousReviewerIds.join(", ") || "none"} →{" "}
                          {change.nextReviewerIds.join(", ")} · {change.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {eligibility && (
                  <p style={{ margin: "0 0 0.35rem", color: "#475569", fontSize: 12 }}>
                    Eligibility: approve {eligibility.canApprove ? "yes" : "no"} ·
                    execute {eligibility.canExecute ? "yes" : "no"}
                    {eligibility.reasons[0] ? ` — ${eligibility.reasons[0]}` : ""}
                  </p>
                )}

                {request.status === "pending" && (
                  <div style={{ marginTop: "0.65rem", display: "grid", gap: "0.5rem" }}>
                    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                      Assign reviewers
                      <select
                        multiple
                        value={assignSelections[request.id] ?? []}
                        onChange={(event) => {
                          const selected = Array.from(
                            event.target.selectedOptions,
                            (option) => option.value,
                          );
                          setAssignSelections((current) => ({
                            ...current,
                            [request.id]: selected,
                          }));
                        }}
                        style={{ ...inputStyle, minHeight: 72 }}
                      >
                        {reviewers
                          .filter((reviewer) => reviewer.active)
                          .map((reviewer) => (
                            <option key={reviewer.id} value={reviewer.id}>
                              {reviewer.name} ({reviewer.role})
                            </option>
                          ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={actingOnId === request.id}
                      onClick={() => void assignReviewers(request.id)}
                      style={{
                        justifySelf: "start",
                        padding: "0.4rem 0.7rem",
                        border: "1px solid #cbd5e1",
                        borderRadius: 6,
                        background: "#fff",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Save assigned reviewers
                    </button>

                    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                      Manual reassignment
                      <select
                        multiple
                        value={reassignSelections[request.id] ?? []}
                        onChange={(event) => {
                          const selected = Array.from(
                            event.target.selectedOptions,
                            (option) => option.value,
                          );
                          setReassignSelections((current) => ({
                            ...current,
                            [request.id]: selected,
                          }));
                        }}
                        style={{ ...inputStyle, minHeight: 72 }}
                      >
                        {reviewers
                          .filter((reviewer) => reviewer.active)
                          .map((reviewer) => (
                            <option key={reviewer.id} value={reviewer.id}>
                              {reviewer.name} ({reviewer.role})
                            </option>
                          ))}
                      </select>
                    </label>
                    <input
                      value={reassignReasons[request.id] ?? ""}
                      onChange={(event) =>
                        setReassignReasons((current) => ({
                          ...current,
                          [request.id]: event.target.value,
                        }))
                      }
                      placeholder="Reassignment reason (required)"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      disabled={actingOnId === request.id}
                      onClick={() => void reassignRequest(request.id)}
                      style={{
                        justifySelf: "start",
                        padding: "0.4rem 0.7rem",
                        border: "1px solid #cbd5e1",
                        borderRadius: 6,
                        background: "#fff",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Reassign ownership
                    </button>

                    <textarea
                      value={decisionNotes[request.id] ?? ""}
                      onChange={(event) =>
                        setDecisionNotes((current) => ({
                          ...current,
                          [request.id]: event.target.value,
                        }))
                      }
                      placeholder="Optional decision note"
                      style={{ ...textareaStyle, minHeight: 56 }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        disabled={
                          actingOnId === request.id || !eligibility?.canApprove
                        }
                        onClick={() => void resolveRequest(request.id, "approved")}
                        style={{
                          padding: "0.4rem 0.7rem",
                          border: "none",
                          borderRadius: 6,
                          background: eligibility?.canApprove ? "#15803d" : "#94a3b8",
                          color: "#fff",
                          cursor: eligibility?.canApprove ? "pointer" : "not-allowed",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actingOnId === request.id}
                        onClick={() => void resolveRequest(request.id, "rejected")}
                        style={{
                          padding: "0.4rem 0.7rem",
                          border: "1px solid #fecaca",
                          borderRadius: 6,
                          background: "#fff",
                          color: "#b91c1c",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={actingOnId === request.id}
                        onClick={() => void resolveRequest(request.id, "cancelled")}
                        style={{
                          padding: "0.4rem 0.7rem",
                          border: "1px solid #cbd5e1",
                          borderRadius: 6,
                          background: "#fff",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {request.status === "approved" && (
                  <button
                    type="button"
                    disabled={actingOnId === request.id || !eligibility?.canExecute}
                    onClick={() => void executeRequest(request)}
                    style={{
                      marginTop: "0.65rem",
                      padding: "0.45rem 0.75rem",
                      border: "none",
                      borderRadius: 6,
                      background: eligibility?.canExecute ? "#0f766e" : "#94a3b8",
                      color: "#fff",
                      cursor: eligibility?.canExecute ? "pointer" : "not-allowed",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {actingOnId === request.id
                      ? "Executing..."
                      : "Execute approved release"}
                  </button>
                )}

                {request.executedBy && (
                  <p style={{ margin: "0.5rem 0 0", color: "#64748b", fontSize: 12 }}>
                    Executed by {request.executedBy.actorLabel}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setOpenCollaborationByRequest((current) => ({
                      ...current,
                      [request.id]: !current[request.id],
                    }))
                  }
                  style={{
                    marginTop: "0.65rem",
                    padding: "0.35rem 0.65rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {openCollaborationByRequest[request.id]
                    ? "Hide review notes"
                    : "Show review notes"}
                </button>

                {openCollaborationByRequest[request.id] && (
                  <>
                    <CommentsPanel
                      targetType="approval_request"
                      targetId={request.id}
                      actorId={actorId}
                      actorLabel={
                        activeReviewer?.name ?? request.requestedBy.actorLabel
                      }
                      title="Approval comments"
                    />
                    <AnnotationPanel
                      targetType="approval_request"
                      targetId={request.id}
                      actorId={actorId}
                      actorLabel={
                        activeReviewer?.name ?? request.requestedBy.actorLabel
                      }
                      title="Approval annotations"
                      defaultAnchorLabel="release rationale"
                    />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
