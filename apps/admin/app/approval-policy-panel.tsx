"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ApprovalPolicyDto,
  ReviewerRole,
  UpdateApprovalPolicyRequestDto,
} from "@retailer-search/shared-types";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

const ROLE_OPTIONS: ReviewerRole[] = [
  "requester",
  "reviewer",
  "approver",
  "release_manager",
];

export function ApprovalPolicyPanel() {
  const [policy, setPolicy] = useState<ApprovalPolicyDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/approval-policy`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`Failed to load approval policy: HTTP ${response.status}`);
      }

      setPolicy((await response.json()) as ApprovalPolicyDto);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load policy",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  const savePolicy = async () => {
    if (!policy) {
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    const payload: UpdateApprovalPolicyRequestDto = {
      requireSecondApprover: policy.requireSecondApprover,
      requireDifferentActorForApproval: policy.requireDifferentActorForApproval,
      requireDifferentActorForExecution: policy.requireDifferentActorForExecution,
      allowedApproverRoles: policy.allowedApproverRoles,
      allowedExecutorRoles: policy.allowedExecutorRoles,
    };

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/approval-policy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error(`Save policy failed with HTTP ${response.status}`);
      }

      setPolicy((await response.json()) as ApprovalPolicyDto);
      setFeedback("Approval policy updated.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save policy",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (
    field: "allowedApproverRoles" | "allowedExecutorRoles",
    role: ReviewerRole,
  ) => {
    if (!policy) {
      return;
    }

    const current = policy[field];
    const next = current.includes(role)
      ? current.filter((item) => item !== role)
      : [...current, role];

    setPolicy({ ...policy, [field]: next });
  };

  if (loading) {
    return (
      <section
        style={{
          padding: "1rem",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#fff",
          fontSize: 14,
          color: "#64748b",
        }}
      >
        Loading approval policy...
      </section>
    );
  }

  if (!policy) {
    return null;
  }

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
        Approval policy
      </h2>

      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Two-person rules and separation of duties for sensitive promotions.
      </p>

      <div style={{ display: "grid", gap: "0.65rem", marginBottom: "1rem" }}>
        <label style={{ display: "flex", gap: "0.5rem", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={policy.requireSecondApprover}
            onChange={(event) =>
              setPolicy({
                ...policy,
                requireSecondApprover: event.target.checked,
              })
            }
          />
          Require second approver (two distinct approvals)
        </label>

        <label style={{ display: "flex", gap: "0.5rem", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={policy.requireDifferentActorForApproval}
            onChange={(event) =>
              setPolicy({
                ...policy,
                requireDifferentActorForApproval: event.target.checked,
              })
            }
          />
          Requester cannot approve their own request
        </label>

        <label style={{ display: "flex", gap: "0.5rem", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={policy.requireDifferentActorForExecution}
            onChange={(event) =>
              setPolicy({
                ...policy,
                requireDifferentActorForExecution: event.target.checked,
              })
            }
          />
          Approver cannot execute the same release
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <strong style={{ fontSize: 13 }}>Allowed approver roles</strong>
          <div style={{ display: "grid", gap: "0.35rem", marginTop: "0.5rem" }}>
            {ROLE_OPTIONS.map((role) => (
              <label key={`approve-${role}`} style={{ fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={policy.allowedApproverRoles.includes(role)}
                  onChange={() => toggleRole("allowedApproverRoles", role)}
                />{" "}
                {role}
              </label>
            ))}
          </div>
        </div>

        <div>
          <strong style={{ fontSize: 13 }}>Allowed executor roles</strong>
          <div style={{ display: "grid", gap: "0.35rem", marginTop: "0.5rem" }}>
            {ROLE_OPTIONS.map((role) => (
              <label key={`execute-${role}`} style={{ fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={policy.allowedExecutorRoles.includes(role)}
                  onChange={() => toggleRole("allowedExecutorRoles", role)}
                />{" "}
                {role}
              </label>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void savePolicy()}
        disabled={saving}
        style={{
          padding: "0.55rem 0.9rem",
          border: "none",
          borderRadius: 6,
          background: "#0f172a",
          color: "#fff",
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        {saving ? "Saving..." : "Save approval policy"}
      </button>

      {feedback && (
        <p style={{ margin: "0.75rem 0 0", color: "#15803d", fontSize: 13 }}>
          {feedback}
        </p>
      )}
      {error && (
        <p style={{ margin: "0.75rem 0 0", color: "#b91c1c", fontSize: 13 }}>
          {error}
        </p>
      )}
    </section>
  );
}
