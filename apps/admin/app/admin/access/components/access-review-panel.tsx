"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AccessReviewListResponseDto,
  AccessReviewRunDto,
  CreateAccessReviewRunDto,
  CurrentUserResponseDto,
  ResolveAccessReviewItemDto,
  UserRole,
} from "@retailer-search/shared-types";
import { getAuthHeaders } from "../../../lib/auth-headers";
import { getSearchApiUrl } from "../../../lib/search-api-url";
import { ALL_USER_ROLES, PRIVILEGED_ROLES } from "../lib/constants";
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
} as const;

function recommendedActionColor(action?: string): string {
  switch (action) {
    case "disable":
      return "#b91c1c";
    case "downgrade":
      return "#b45309";
    case "review":
      return "#2563eb";
    default:
      return "#047857";
  }
}

export function AccessReviewPanel() {
  const [currentUser, setCurrentUser] = useState<CurrentUserResponseDto | null>(
    null,
  );
  const [runs, setRuns] = useState<AccessReviewRunDto[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [selectedRun, setSelectedRun] = useState<AccessReviewRunDto | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([
    ...PRIVILEGED_ROLES,
  ]);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actingOnUserId, setActingOnUserId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isAdmin = currentUser?.user?.role === "admin";

  const loadRuns = useCallback(async () => {
    if (!isAdmin) {
      setRuns([]);
      setSelectedRun(null);
      return;
    }

    const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/access-reviews`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to load access reviews (HTTP ${response.status})`);
    }

    const body = (await response.json()) as AccessReviewListResponseDto;
    setRuns(body.runs);
  }, [isAdmin]);

  const loadPanelData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const meRes = await fetch(`${getSearchApiUrl()}/api/v1/auth/me`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      });

      if (meRes.ok) {
        const meBody = (await meRes.json()) as CurrentUserResponseDto;
        setCurrentUser(meBody);

        if (meBody.user?.role === "admin") {
          await loadRuns();
        }
      } else {
        setCurrentUser({ authenticated: false });
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load access review data",
      );
    } finally {
      setLoading(false);
    }
  }, [loadRuns]);

  const loadSelectedRun = useCallback(async (runId: string) => {
    if (!runId) {
      setSelectedRun(null);
      return;
    }

    const response = await fetch(
      `${getSearchApiUrl()}/api/v1/admin/access-reviews/${runId}`,
      {
        headers: getAuthHeaders(),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to load review run (HTTP ${response.status})`);
    }

    setSelectedRun((await response.json()) as AccessReviewRunDto);
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

  useEffect(() => {
    if (selectedRunId) {
      void loadSelectedRun(selectedRunId).catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load selected review run",
        );
      });
    }
  }, [selectedRunId, loadSelectedRun]);

  useEffect(() => {
    if (!selectedRunId && runs.length > 0) {
      const openRun = runs.find((run) => run.status === "open");
      setSelectedRunId(openRun?.id ?? runs[0]?.id ?? "");
    }
  }, [runs, selectedRunId]);

  const notifyChanged = () => {
    window.dispatchEvent(new CustomEvent(ACCESS_GOVERNANCE_CHANGED_EVENT));
  };

  const toggleRole = (role: UserRole) => {
    setSelectedRoles((current) =>
      current.includes(role)
        ? current.filter((entry) => entry !== role)
        : [...current, role],
    );
  };

  const startReviewRun = async () => {
    setCreating(true);
    setError(null);
    setFeedback(null);

    const payload: CreateAccessReviewRunDto = {
      roles: selectedRoles.length > 0 ? selectedRoles : undefined,
    };

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/access-reviews`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as
        | AccessReviewRunDto
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          body && "error" in body
            ? body.error
            : `Create review failed with HTTP ${response.status}`,
        );
      }

      const run = body as AccessReviewRunDto;
      setSelectedRunId(run.id);
      setFeedback(`Started access review run ${run.id}.`);
      notifyChanged();
      await loadRuns();
      await loadSelectedRun(run.id);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to start access review",
      );
    } finally {
      setCreating(false);
    }
  };

  const resolveItem = async (
    userId: string,
    action: ResolveAccessReviewItemDto["action"],
  ) => {
    if (!selectedRun) {
      return;
    }

    setActingOnUserId(userId);
    setError(null);
    setFeedback(null);

    const payload: ResolveAccessReviewItemDto = {
      userId,
      action,
      note: itemNotes[userId]?.trim() || undefined,
    };

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/access-reviews/${selectedRun.id}/items/resolve`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Review action failed with HTTP ${response.status}`);
      }

      setFeedback(`Recorded ${action} for user in review run.`);
      notifyChanged();
      await loadSelectedRun(selectedRun.id);
      await loadRuns();
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "Failed to resolve review item",
      );
    } finally {
      setActingOnUserId(null);
    }
  };

  const completeReviewRun = async () => {
    if (!selectedRun) {
      return;
    }

    setCompleting(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/access-reviews/${selectedRun.id}/complete`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        },
      );

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Complete failed with HTTP ${response.status}`);
      }

      setFeedback(`Completed access review run ${selectedRun.id}.`);
      notifyChanged();
      await loadRuns();
      await loadSelectedRun(selectedRun.id);
    } catch (completeError) {
      setError(
        completeError instanceof Error
          ? completeError.message
          : "Failed to complete access review",
      );
    } finally {
      setCompleting(false);
    }
  };

  if (!isAdmin) {
    return (
      <section style={panelStyle}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Access Reviews</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          Periodic access reviews are available to admins only.
        </p>
      </section>
    );
  }

  return (
    <section style={panelStyle}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Access Reviews</h2>
      <p style={{ marginTop: 0, color: "#475569", fontSize: 13 }}>
        Start periodic recertification runs for privileged or stale access. Review
        each user, then complete the run when finished.
      </p>

      {loading ? <p style={{ fontSize: 13 }}>Loading access reviews…</p> : null}
      {error ? (
        <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</p>
      ) : null}
      {feedback ? (
        <p style={{ color: "#047857", fontSize: 13, marginBottom: 12 }}>{feedback}</p>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: 10,
          marginBottom: 16,
          paddingBottom: 16,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>Start new review run</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ALL_USER_ROLES.map((role) => (
            <label
              key={role}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                border: "1px solid #cbd5e1",
                borderRadius: 999,
                padding: "0.25rem 0.6rem",
                background: selectedRoles.includes(role) ? "#eff6ff" : "#fff",
              }}
            >
              <input
                type="checkbox"
                checked={selectedRoles.includes(role)}
                onChange={() => toggleRole(role)}
              />
              {role}
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={() => void startReviewRun()}
          style={{
            width: "fit-content",
            padding: "0.45rem 0.85rem",
            borderRadius: 6,
            border: "1px solid #334155",
            background: "var(--forge-primary)",
            color: "#fff",
            cursor: creating ? "wait" : "pointer",
            fontSize: 13,
          }}
        >
          {creating ? "Starting…" : "Start access review run"}
        </button>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "220px 1fr" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Previous runs
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {runs.length === 0 ? (
              <p style={{ fontSize: 12, color: "#64748b" }}>No review runs yet.</p>
            ) : null}
            {runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => setSelectedRunId(run.id)}
                style={{
                  textAlign: "left",
                  padding: "0.5rem",
                  borderRadius: 6,
                  border:
                    selectedRunId === run.id
                      ? "1px solid #2563eb"
                      : "1px solid #e2e8f0",
                  background: selectedRunId === run.id ? "#eff6ff" : "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 600 }}>{run.id}</div>
                <div style={{ color: "#64748b" }}>
                  {run.status} · {run.items.length} users
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          {selectedRun ? (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedRun.id}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Scope: {selectedRun.scope.roles.join(", ")} · Status:{" "}
                    {selectedRun.status}
                  </div>
                </div>
                {selectedRun.status === "open" ? (
                  <button
                    type="button"
                    disabled={completing}
                    onClick={() => void completeReviewRun()}
                    style={{
                      padding: "0.4rem 0.75rem",
                      borderRadius: 6,
                      border: "1px solid #047857",
                      background: "#ecfdf5",
                      cursor: completing ? "wait" : "pointer",
                      fontSize: 12,
                    }}
                  >
                    {completing ? "Completing…" : "Complete review run"}
                  </button>
                ) : null}
              </div>

              {selectedRun.summary ? (
                <div
                  style={{
                    fontSize: 12,
                    color: "#475569",
                    marginBottom: 10,
                    padding: "0.5rem 0.75rem",
                    background: "#f8fafc",
                    borderRadius: 6,
                  }}
                >
                  Reviewed {selectedRun.summary.totalUsers} users · Privileged roles:{" "}
                  {selectedRun.summary.adminsReviewed} · Inactive flagged:{" "}
                  {selectedRun.summary.inactiveUsersFlagged}
                </div>
              ) : null}

              <div style={{ display: "grid", gap: 10 }}>
                {selectedRun.items.map((item) => (
                  <article
                    key={item.userId}
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
                        <strong style={{ fontSize: 14 }}>{item.userName}</strong>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {item.userEmail}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: recommendedActionColor(item.recommendedAction),
                        }}
                      >
                        {item.recommendedAction ?? "keep"}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, marginTop: 8 }}>
                      Role: <strong>{item.currentRole}</strong> · Active:{" "}
                      {item.active ? "yes" : "no"}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      Last login:{" "}
                      {item.lastLoginAt
                        ? new Date(item.lastLoginAt).toLocaleString()
                        : "never"}
                    </div>
                    {item.note ? (
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                        Note: {item.note}
                      </div>
                    ) : null}

                    {selectedRun.status === "open" ? (
                      <>
                        <input
                          value={itemNotes[item.userId] ?? ""}
                          onChange={(event) =>
                            setItemNotes((current) => ({
                              ...current,
                              [item.userId]: event.target.value,
                            }))
                          }
                          placeholder="Optional reviewer note"
                          style={{ ...inputStyle, width: "100%", marginTop: 8 }}
                        />
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            disabled={actingOnUserId === item.userId}
                            onClick={() => void resolveItem(item.userId, "keep")}
                            style={{
                              padding: "0.35rem 0.7rem",
                              fontSize: 12,
                              borderRadius: 6,
                              border: "1px solid #047857",
                              background: "#ecfdf5",
                              cursor: "pointer",
                            }}
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            disabled={actingOnUserId === item.userId}
                            onClick={() => void resolveItem(item.userId, "downgrade")}
                            style={{
                              padding: "0.35rem 0.7rem",
                              fontSize: 12,
                              borderRadius: 6,
                              border: "1px solid #b45309",
                              background: "#fffbeb",
                              cursor: "pointer",
                            }}
                          >
                            Downgrade
                          </button>
                          <button
                            type="button"
                            disabled={actingOnUserId === item.userId}
                            onClick={() => void resolveItem(item.userId, "disable")}
                            style={{
                              padding: "0.35rem 0.7rem",
                              fontSize: 12,
                              borderRadius: 6,
                              border: "1px solid #b91c1c",
                              background: "#fef2f2",
                              cursor: "pointer",
                            }}
                          >
                            Disable
                          </button>
                        </div>
                      </>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: "#64748b" }}>
              Select a review run to inspect users.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
