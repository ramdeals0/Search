"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useCallback, useEffect, useState } from "react";
import type {
  ActivePrivilegeDto,
  ActivePrivilegeListResponseDto,
  CreateJitElevationRequestDto,
  CurrentUserResponseDto,
  JitElevationRequestDto,
  JitElevationRequestListResponseDto,
  JitPolicyDto,
  ResolveJitElevationRequestDto,
  UpdateJitPolicyRequestDto,
  UserRole,
} from "@retailer-search/shared-types";
import {
  ACCESS_GOVERNANCE_CHANGED_EVENT,
  AUTH_TOKEN_STORAGE_KEY,
} from "./access-request-panel";

export const JIT_ACCESS_CHANGED_EVENT = "admin:jit-access-changed";

const ELEVATABLE_ROLES: UserRole[] = [
  "reviewer",
  "approver",
  "release_manager",
  "admin",
];

const ALL_ROLES: UserRole[] = [
  "merchandiser",
  "reviewer",
  "approver",
  "release_manager",
  "admin",
];

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
  width: "100%",
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

function statusColor(status: JitElevationRequestDto["status"]): string {
  switch (status) {
    case "active":
      return "#047857";
    case "pending":
      return "#b45309";
    case "denied":
    case "revoked":
      return "#b91c1c";
    case "expired":
    case "cancelled":
      return "#64748b";
    default:
      return "#334155";
  }
}

export function JitAccessPanel() {
  const [currentUser, setCurrentUser] = useState<CurrentUserResponseDto | null>(
    null,
  );
  const [policy, setPolicy] = useState<JitPolicyDto | null>(null);
  const [requests, setRequests] = useState<JitElevationRequestDto[]>([]);
  const [activePrivileges, setActivePrivileges] = useState<ActivePrivilegeDto[]>(
    [],
  );
  const [requestedRole, setRequestedRole] = useState<UserRole>("approver");
  const [justification, setJustification] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [reviewerNote, setReviewerNote] = useState("");
  const [policyDraft, setPolicyDraft] = useState<UpdateJitPolicyRequestDto | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isAdmin = currentUser?.user?.role === "admin";
  const isElevated =
    currentUser?.activePrivilege?.source === "jit" &&
    currentUser.effectiveRole !== currentUser.standingRole;

  const notifyChanged = () => {
    window.dispatchEvent(new CustomEvent(JIT_ACCESS_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent(ACCESS_GOVERNANCE_CHANGED_EVENT));
  };

  const loadPanelData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [meRes, policyRes, requestsRes, privilegesRes] = await Promise.all([
        fetch(`${getSearchApiUrl()}/api/v1/auth/me`, {
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
        fetch(`${getSearchApiUrl()}/api/v1/admin/jit-policy`, {
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
        fetch(`${getSearchApiUrl()}/api/v1/admin/jit-requests`, {
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
        fetch(`${getSearchApiUrl()}/api/v1/admin/active-privileges`, {
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
      ]);

      if (meRes.ok) {
        const meBody = (await meRes.json()) as CurrentUserResponseDto;
        setCurrentUser(meBody);
      } else {
        setCurrentUser({ authenticated: false });
      }

      if (policyRes.ok) {
        const policyBody = (await policyRes.json()) as JitPolicyDto;
        setPolicy(policyBody);
        setPolicyDraft(policyBody);
        setDurationMinutes(policyBody.defaultDurationMinutes);
      }

      if (requestsRes.ok) {
        const requestsBody =
          (await requestsRes.json()) as JitElevationRequestListResponseDto;
        setRequests(requestsBody.requests);
      }

      if (privilegesRes.ok) {
        const privilegesBody =
          (await privilegesRes.json()) as ActivePrivilegeListResponseDto;
        setActivePrivileges(privilegesBody.privileges);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load JIT access data",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPanelData();
    const interval = window.setInterval(() => {
      void loadPanelData();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [loadPanelData]);

  useEffect(() => {
    const handler = () => {
      void loadPanelData();
    };
    window.addEventListener(JIT_ACCESS_CHANGED_EVENT, handler);
    window.addEventListener(ACCESS_GOVERNANCE_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(JIT_ACCESS_CHANGED_EVENT, handler);
      window.removeEventListener(ACCESS_GOVERNANCE_CHANGED_EVENT, handler);
    };
  }, [loadPanelData]);

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFeedback(null);

    const payload: CreateJitElevationRequestDto = {
      requestedRole,
      justification: justification.trim(),
      requestedDurationMinutes: durationMinutes,
    };

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/jit-requests`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as
        | JitElevationRequestDto
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          body && "error" in body
            ? body.error
            : `JIT request failed with HTTP ${response.status}`,
        );
      }

      setJustification("");
      setFeedback(
        (body as JitElevationRequestDto).status === "active"
          ? "Temporary elevation activated immediately."
          : "JIT elevation request submitted for approval.",
      );
      notifyChanged();
      await loadPanelData();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit JIT elevation request",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resolveRequest = async (
    requestId: string,
    decision: ResolveJitElevationRequestDto["decision"],
  ) => {
    setActingOnId(requestId);
    setError(null);
    setFeedback(null);

    const payload: ResolveJitElevationRequestDto = {
      decision,
      reviewerNote: reviewerNote.trim() || undefined,
    };

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/jit-requests/${requestId}/resolve`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Resolve failed with HTTP ${response.status}`);
      }

      setReviewerNote("");
      setFeedback(`JIT request ${decision}.`);
      notifyChanged();
      await loadPanelData();
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "Failed to resolve JIT request",
      );
    } finally {
      setActingOnId(null);
    }
  };

  const revokeRequest = async (requestId: string) => {
    setActingOnId(requestId);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/jit-requests/${requestId}/revoke`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        },
      );

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Revoke failed with HTTP ${response.status}`);
      }

      setFeedback("Active JIT elevation revoked.");
      notifyChanged();
      await loadPanelData();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error ? revokeError.message : "Failed to revoke JIT access",
      );
    } finally {
      setActingOnId(null);
    }
  };

  const savePolicy = async () => {
    if (!policyDraft) {
      return;
    }

    setSavingPolicy(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/jit-policy`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(policyDraft),
      });

      const body = (await response.json().catch(() => null)) as
        | JitPolicyDto
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          body && "error" in body
            ? body.error
            : `Policy update failed with HTTP ${response.status}`,
        );
      }

      setFeedback("JIT policy updated.");
      notifyChanged();
      await loadPanelData();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to update JIT policy",
      );
    } finally {
      setSavingPolicy(false);
    }
  };

  const availableRoles = ELEVATABLE_ROLES.filter(
    (role) => policy?.elevatableRoles.includes(role),
  );

  return (
    <section id="jit-access" style={panelStyle}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Just-in-Time Access</h2>
      <p style={{ marginTop: 0, color: "#475569", fontSize: 13 }}>
        Request short-lived elevated permissions for a specific task. Standing role
        stays unchanged; effective permissions auto-expire.
      </p>

      {loading ? <p style={{ fontSize: 13 }}>Loading JIT access…</p> : null}
      {error ? (
        <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</p>
      ) : null}
      {feedback ? (
        <p style={{ color: "#047857", fontSize: 13, marginBottom: 12 }}>{feedback}</p>
      ) : null}

      {currentUser?.authenticated ? (
        <div
          style={{
            display: "grid",
            gap: 8,
            marginBottom: 16,
            padding: "0.75rem",
            borderRadius: 6,
            background: isElevated ? "#fffbeb" : "#f8fafc",
            border: isElevated ? "1px solid #f59e0b" : "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: 13 }}>
            Standing role: <strong>{currentUser.standingRole ?? currentUser.user?.role}</strong>
          </div>
          <div style={{ fontSize: 13 }}>
            Effective role:{" "}
            <strong style={{ color: isElevated ? "#b45309" : "var(--forge-primary)" }}>
              {currentUser.effectiveRole ?? currentUser.user?.role}
            </strong>
            {isElevated ? (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#b45309",
                  textTransform: "uppercase",
                }}
              >
                Temporary elevation
              </span>
            ) : null}
          </div>
          {currentUser.activePrivilege?.expiresAt ? (
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Expires: {new Date(currentUser.activePrivilege.expiresAt).toLocaleString()}
            </div>
          ) : null}
        </div>
      ) : null}

      {activePrivileges.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Active temporary privileges
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {activePrivileges.map((privilege) => (
              <div
                key={`${privilege.userId}-${privilege.elevatedByRequestId ?? "standing"}`}
                style={{
                  padding: "0.6rem 0.75rem",
                  borderRadius: 6,
                  border: "1px solid #fde68a",
                  background: "#fffbeb",
                  fontSize: 12,
                }}
              >
                <strong>{privilege.email}</strong>: {privilege.baseRole} →{" "}
                {privilege.effectiveRole}
                {privilege.expiresAt
                  ? ` · expires ${new Date(privilege.expiresAt).toLocaleString()}`
                  : ""}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {currentUser?.authenticated && policy?.enabled ? (
        <form
          onSubmit={submitRequest}
          style={{
            display: "grid",
            gap: 10,
            marginBottom: 16,
            paddingBottom: 16,
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600 }}>Request temporary elevation</div>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Requested role
            <select
              value={requestedRole}
              onChange={(event) => setRequestedRole(event.target.value as UserRole)}
              style={inputStyle}
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Duration (minutes, max {policy.maxDurationMinutes})
            <input
              type="number"
              min={1}
              max={policy.maxDurationMinutes}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              style={inputStyle}
              required
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Justification
            <textarea
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              rows={3}
              placeholder="Explain the task requiring temporary access (minimum 8 characters)."
              style={{ ...inputStyle, resize: "vertical" }}
              required
            />
          </label>
          <button
            type="submit"
            disabled={submitting || isElevated}
            style={{
              width: "fit-content",
              padding: "0.45rem 0.85rem",
              borderRadius: 6,
              border: "1px solid #b45309",
              background: "#fffbeb",
              color: "#92400e",
              cursor: submitting ? "wait" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {submitting ? "Submitting…" : "Request JIT elevation"}
          </button>
          {isElevated ? (
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
              You already have an active temporary elevation.
            </p>
          ) : null}
        </form>
      ) : null}

      {isAdmin && policyDraft ? (
        <div
          style={{
            marginBottom: 16,
            paddingBottom: 16,
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            JIT policy (admin)
          </div>
          <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={policyDraft.enabled}
                onChange={(event) =>
                  setPolicyDraft({ ...policyDraft, enabled: event.target.checked })
                }
              />
              JIT elevation enabled
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Default duration (minutes)
              <input
                type="number"
                min={1}
                value={policyDraft.defaultDurationMinutes}
                onChange={(event) =>
                  setPolicyDraft({
                    ...policyDraft,
                    defaultDurationMinutes: Number(event.target.value),
                  })
                }
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Max duration (minutes)
              <input
                type="number"
                min={1}
                value={policyDraft.maxDurationMinutes}
                onChange={(event) =>
                  setPolicyDraft({
                    ...policyDraft,
                    maxDurationMinutes: Number(event.target.value),
                  })
                }
                style={inputStyle}
              />
            </label>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Approval required for:{" "}
              {ALL_ROLES.map((role) => (
                <label key={role} style={{ marginRight: 8 }}>
                  <input
                    type="checkbox"
                    checked={policyDraft.approvalRequiredRoles.includes(role)}
                    onChange={() =>
                      setPolicyDraft({
                        ...policyDraft,
                        approvalRequiredRoles: policyDraft.approvalRequiredRoles.includes(
                          role,
                        )
                          ? policyDraft.approvalRequiredRoles.filter(
                              (entry) => entry !== role,
                            )
                          : [...policyDraft.approvalRequiredRoles, role],
                      })
                    }
                  />{" "}
                  {role}
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={savingPolicy}
              onClick={() => void savePolicy()}
              style={{
                width: "fit-content",
                padding: "0.4rem 0.75rem",
                borderRadius: 6,
                border: "1px solid #334155",
                background: "var(--forge-primary)",
                color: "#fff",
                cursor: savingPolicy ? "wait" : "pointer",
                fontSize: 12,
              }}
            >
              {savingPolicy ? "Saving…" : "Save JIT policy"}
            </button>
          </div>
        </div>
      ) : null}

      {isAdmin ? (
        <label style={{ display: "grid", gap: 4, fontSize: 13, marginBottom: 12 }}>
          Admin reviewer note (optional)
          <input
            value={reviewerNote}
            onChange={(event) => setReviewerNote(event.target.value)}
            placeholder="Reason for approval, denial, or cancellation"
            style={inputStyle}
          />
        </label>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        {requests.length === 0 && !loading ? (
          <p style={{ fontSize: 13, color: "#64748b" }}>No JIT elevation requests yet.</p>
        ) : null}

        {requests.map((request) => (
          <article
            key={request.id}
            style={{
              border:
                request.status === "active"
                  ? "1px solid #f59e0b"
                  : "1px solid #e2e8f0",
              borderRadius: 6,
              padding: "0.75rem",
              background: request.status === "active" ? "#fffbeb" : "#f8fafc",
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
              <div>
                <strong style={{ fontSize: 14 }}>{request.requesterName}</strong>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {request.requesterEmail}
                </div>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: statusColor(request.status),
                }}
              >
                {request.status}
              </span>
            </div>

            <div style={{ fontSize: 13, marginTop: 8 }}>
              {request.baseRole} → <strong>{request.requestedRole}</strong> for{" "}
              {request.requestedDurationMinutes} minutes
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              Justification: {request.justification}
            </div>
            {request.activatedAt ? (
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                Activated: {new Date(request.activatedAt).toLocaleString()}
              </div>
            ) : null}
            {request.expiresAt ? (
              <div style={{ fontSize: 12, color: "#b45309", marginTop: 4 }}>
                Expires: {new Date(request.expiresAt).toLocaleString()}
              </div>
            ) : null}
            {request.reviewerNote ? (
              <div style={{ fontSize: 13, marginTop: 4, color: "#475569" }}>
                Reviewer note: {request.reviewerNote}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {request.status === "pending" && isAdmin ? (
                <>
                  <button
                    type="button"
                    disabled={actingOnId === request.id}
                    onClick={() => void resolveRequest(request.id, "approve")}
                    style={{
                      padding: "0.35rem 0.7rem",
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid #047857",
                      background: "#ecfdf5",
                      cursor: "pointer",
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={actingOnId === request.id}
                    onClick={() => void resolveRequest(request.id, "deny")}
                    style={{
                      padding: "0.35rem 0.7rem",
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid #b91c1c",
                      background: "#fef2f2",
                      cursor: "pointer",
                    }}
                  >
                    Deny
                  </button>
                </>
              ) : null}
              {request.status === "pending" &&
              (isAdmin || request.requesterUserId === currentUser?.user?.id) ? (
                <button
                  type="button"
                  disabled={actingOnId === request.id}
                  onClick={() => void resolveRequest(request.id, "cancel")}
                  style={{
                    padding: "0.35rem 0.7rem",
                    fontSize: 12,
                    borderRadius: 6,
                    border: "1px solid #64748b",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              ) : null}
              {request.status === "active" && isAdmin ? (
                <button
                  type="button"
                  disabled={actingOnId === request.id}
                  onClick={() => void revokeRequest(request.id)}
                  style={{
                    padding: "0.35rem 0.7rem",
                    fontSize: 12,
                    borderRadius: 6,
                    border: "1px solid #b91c1c",
                    background: "#fef2f2",
                    cursor: "pointer",
                  }}
                >
                  Revoke
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
