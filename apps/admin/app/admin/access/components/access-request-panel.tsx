"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AccessRequestDto,
  AccessRequestListResponseDto,
  CreateAccessRequestDto,
  CurrentUserResponseDto,
  ResolveAccessRequestDto,
  UserRole,
} from "@retailer-search/shared-types";
import { getAuthHeaders } from "../../../lib/auth-headers";
import { getSearchApiUrl } from "../../../lib/search-api-url";
import { ALL_USER_ROLES } from "../lib/constants";
import { ACCESS_GOVERNANCE_CHANGED_EVENT } from "../lib/events";

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

interface AccessRequestPanelProps {
  scrollTargetId?: string;
}

export function AccessRequestPanel({
  scrollTargetId = "access-requests",
}: AccessRequestPanelProps) {
  const [requests, setRequests] = useState<AccessRequestDto[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUserResponseDto | null>(
    null,
  );
  const [requestedRole, setRequestedRole] = useState<UserRole>("reviewer");
  const [justification, setJustification] = useState("");
  const [reviewerNote, setReviewerNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isAdmin = currentUser?.user?.role === "admin";

  const loadPanelData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [meRes, requestsRes] = await Promise.all([
        fetch(`${getSearchApiUrl()}/api/v1/auth/me`, {
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
        fetch(`${getSearchApiUrl()}/api/v1/admin/access-requests`, {
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
      ]);

      if (meRes.ok) {
        setCurrentUser((await meRes.json()) as CurrentUserResponseDto);
      } else {
        setCurrentUser({ authenticated: false });
      }

      if (!requestsRes.ok) {
        throw new Error(`Failed to load access requests (HTTP ${requestsRes.status})`);
      }

      const body = (await requestsRes.json()) as AccessRequestListResponseDto;
      setRequests(body.requests);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load access requests",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPanelData();
  }, [loadPanelData]);

  useEffect(() => {
    const handler = () => {
      void loadPanelData();
    };
    window.addEventListener(ACCESS_GOVERNANCE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(ACCESS_GOVERNANCE_CHANGED_EVENT, handler);
  }, [loadPanelData]);

  const notifyChanged = () => {
    window.dispatchEvent(new CustomEvent(ACCESS_GOVERNANCE_CHANGED_EVENT));
  };

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFeedback(null);

    const payload: CreateAccessRequestDto = {
      requestedRole,
      justification: justification.trim(),
    };

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/access-requests`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Request failed with HTTP ${response.status}`);
      }

      setJustification("");
      setFeedback("Access request submitted.");
      notifyChanged();
      await loadPanelData();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit access request",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resolveRequest = async (
    requestId: string,
    decision: ResolveAccessRequestDto["decision"],
  ) => {
    setActingOnId(requestId);
    setError(null);
    setFeedback(null);

    const payload: ResolveAccessRequestDto = {
      decision,
      reviewerNote: reviewerNote.trim() || undefined,
    };

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/access-requests/${requestId}/resolve`,
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
      setFeedback(`Access request ${decision}.`);
      notifyChanged();
      await loadPanelData();
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "Failed to resolve access request",
      );
    } finally {
      setActingOnId(null);
    }
  };

  const availableRoles = ALL_USER_ROLES.filter(
    (role) => role !== currentUser?.user?.role,
  );

  return (
    <section id={scrollTargetId} style={panelStyle}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Access Requests</h2>
      <p style={{ marginTop: 0, color: "#475569", fontSize: 13 }}>
        Request a role change for your account. Admins can approve, deny, or cancel
        requests. Role changes take effect only after admin approval.
      </p>

      {loading ? <p style={{ fontSize: 13 }}>Loading access requests…</p> : null}
      {error ? (
        <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</p>
      ) : null}
      {feedback ? (
        <p style={{ color: "#047857", fontSize: 13, marginBottom: 12 }}>{feedback}</p>
      ) : null}

      {currentUser?.authenticated ? (
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
          <div style={{ fontSize: 13, color: "#334155" }}>
            Signed in as <strong>{currentUser.user?.email}</strong> (
            {currentUser.user?.role})
          </div>
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
            Justification
            <textarea
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              rows={3}
              placeholder="Explain why you need this role (minimum 8 characters)."
              style={{ ...inputStyle, resize: "vertical" }}
              required
            />
          </label>
          <button
            type="submit"
            disabled={submitting || availableRoles.length === 0}
            style={{
              width: "fit-content",
              padding: "0.45rem 0.85rem",
              borderRadius: 6,
              border: "1px solid #334155",
              background: "var(--forge-primary)",
              color: "#fff",
              cursor: submitting ? "wait" : "pointer",
              fontSize: 13,
            }}
          >
            {submitting ? "Submitting…" : "Submit access request"}
          </button>
        </form>
      ) : (
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
          Sign in to submit an access request.
        </p>
      )}

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
          <p style={{ fontSize: 13, color: "#64748b" }}>No access requests yet.</p>
        ) : null}

        {requests.map((request) => (
          <article
            key={request.id}
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
              <div>
                <strong style={{ fontSize: 14 }}>{request.requesterName}</strong>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {request.requesterEmail}
                </div>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  color:
                    request.status === "approved"
                      ? "#047857"
                      : request.status === "denied"
                        ? "#b91c1c"
                        : request.status === "cancelled"
                          ? "#64748b"
                          : "#b45309",
                }}
              >
                {request.status}
              </span>
            </div>

            <div style={{ fontSize: 13, marginTop: 8 }}>
              Requested role: <strong>{request.requestedRole}</strong>
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              Justification: {request.justification}
            </div>
            {request.reviewerNote ? (
              <div style={{ fontSize: 13, marginTop: 4, color: "#475569" }}>
                Reviewer note: {request.reviewerNote}
              </div>
            ) : null}
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
              Created {new Date(request.createdAt).toLocaleString()}
              {request.updatedAt !== request.createdAt
                ? ` · Updated ${new Date(request.updatedAt).toLocaleString()}`
                : ""}
              {request.reviewerName ? ` · Reviewed by ${request.reviewerName}` : ""}
            </div>

            {request.status === "pending" ? (
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {isAdmin ? (
                  <>
                    <button
                      type="button"
                      disabled={actingOnId === request.id}
                      onClick={() => void resolveRequest(request.id, "approved")}
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
                      onClick={() => void resolveRequest(request.id, "denied")}
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
                    <button
                      type="button"
                      disabled={actingOnId === request.id}
                      onClick={() => void resolveRequest(request.id, "cancelled")}
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
                  </>
                ) : null}
                {!isAdmin && request.requesterUserId === currentUser?.user?.id ? (
                  <button
                    type="button"
                    disabled={actingOnId === request.id}
                    onClick={() => void resolveRequest(request.id, "cancelled")}
                    style={{
                      padding: "0.35rem 0.7rem",
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid #64748b",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Cancel request
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
