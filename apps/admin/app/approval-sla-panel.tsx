"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useCallback, useEffect, useState } from "react";
import type {
  ApprovalSlaOverviewDto,
  ApprovalSlaPolicyDto,
  ApprovalSlaStatusDto,
  UpdateApprovalSlaPolicyRequestDto,
} from "@retailer-search/shared-types";
import { ADMIN_APPROVALS_CHANGED_EVENT } from "./approval-panel";

export const ADMIN_SLA_CHANGED_EVENT = "admin:approval-sla-changed";

const SLA_STATUS_COLORS: Record<ApprovalSlaStatusDto["status"], string> = {
  on_track: "#15803d",
  due_soon: "#b45309",
  overdue: "#b91c1c",
  completed: "#64748b",
};

const inputStyle = {
  padding: "0.45rem 0.6rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 13,
  width: "100%",
} as const;

export function ApprovalSlaPanel() {
  const [overview, setOverview] = useState<ApprovalSlaOverviewDto | null>(null);
  const [policy, setPolicy] = useState<ApprovalSlaPolicyDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadSlaData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [overviewRes, policyRes] = await Promise.all([
        fetch(`${getSearchApiUrl()}/api/v1/admin/approval-sla`, { cache: "no-store" }),
        fetch(`${getSearchApiUrl()}/api/v1/admin/approval-sla/policy`, {
          cache: "no-store",
        }),
      ]);

      if (!overviewRes.ok || !policyRes.ok) {
        throw new Error("Failed to load approval SLA data");
      }

      setOverview((await overviewRes.json()) as ApprovalSlaOverviewDto);
      setPolicy((await policyRes.json()) as ApprovalSlaPolicyDto);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load SLA panel",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSlaData();

    const handler = () => {
      void loadSlaData();
    };

    window.addEventListener(ADMIN_APPROVALS_CHANGED_EVENT, handler);
    window.addEventListener(ADMIN_SLA_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(ADMIN_APPROVALS_CHANGED_EVENT, handler);
      window.removeEventListener(ADMIN_SLA_CHANGED_EVENT, handler);
    };
  }, [loadSlaData]);

  const savePolicy = async () => {
    if (!policy) {
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    const payload: UpdateApprovalSlaPolicyRequestDto = {
      enabled: policy.enabled,
      reminderAfterHours: policy.reminderAfterHours,
      overdueAfterHours: policy.overdueAfterHours,
      escalationAfterHours: policy.escalationAfterHours,
    };

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/approval-sla/policy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error(`Save SLA policy failed with HTTP ${response.status}`);
      }

      setPolicy((await response.json()) as ApprovalSlaPolicyDto);
      setFeedback("SLA policy updated.");
      await loadSlaData();
      window.dispatchEvent(new CustomEvent(ADMIN_SLA_CHANGED_EVENT));
      window.dispatchEvent(new CustomEvent("admin:notifications-changed"));
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save SLA policy",
      );
    } finally {
      setSaving(false);
    }
  };

  const pendingItems =
    overview?.items.filter((item) => item.status !== "completed") ?? [];

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
        Approval SLA tracking
      </h2>

      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Monitor pending approvals, reminder thresholds, and overdue visibility.
        Reminders are generated on-demand when SLA or inbox endpoints are fetched.
      </p>

      {loading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Loading SLA overview...
        </p>
      )}

      {error && (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 13 }}>
          {error}
        </p>
      )}
      {feedback && (
        <p style={{ margin: "0 0 0.75rem", color: "#15803d", fontSize: 13 }}>
          {feedback}
        </p>
      )}

      {!loading && overview && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "0.65rem",
              marginBottom: "1rem",
            }}
          >
            {(
              [
                ["Pending", overview.summary.pendingCount, "#334155"],
                ["Due soon", overview.summary.dueSoonCount, "#b45309"],
                ["Overdue", overview.summary.overdueCount, "#b91c1c"],
                ["Completed", overview.summary.completedCount, "#64748b"],
              ] as const
            ).map(([label, count, color]) => (
              <div
                key={label}
                style={{
                  padding: "0.65rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  background: "#f8fafc",
                }}
              >
                <div style={{ fontSize: 11, color: "#64748b" }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color }}>{count}</div>
              </div>
            ))}
          </div>

          <p style={{ margin: "0 0 0.5rem", fontSize: 12, color: "#64748b" }}>
            Generated at {new Date(overview.generatedAt).toLocaleString()}
          </p>

          {pendingItems.length === 0 ? (
            <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#94a3b8" }}>
              No open approval requests to track.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: "0 0 1rem",
                padding: 0,
                display: "grid",
                gap: "0.5rem",
              }}
            >
              {pendingItems.map((item) => (
                <li
                  key={item.approvalRequestId}
                  style={{
                    padding: "0.65rem",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                      alignItems: "center",
                      marginBottom: "0.25rem",
                    }}
                  >
                    <strong>{item.approvalRequestId}</strong>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: SLA_STATUS_COLORS[item.status],
                      }}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                    <span style={{ color: "#64748b" }}>{item.ageHours}h old</span>
                  </div>
                  <p style={{ margin: 0, color: "#64748b" }}>
                    Reminder at{" "}
                    {item.targetReminderAt
                      ? new Date(item.targetReminderAt).toLocaleString()
                      : "—"}{" "}
                    · Overdue at{" "}
                    {item.targetOverdueAt
                      ? new Date(item.targetOverdueAt).toLocaleString()
                      : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {policy && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void savePolicy();
          }}
          style={{
            display: "grid",
            gap: "0.65rem",
            padding: "0.85rem",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            background: "#f8fafc",
          }}
        >
          <strong style={{ fontSize: 14 }}>SLA policy</strong>

          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={policy.enabled}
              onChange={(event) =>
                setPolicy({ ...policy, enabled: event.target.checked })
              }
            />
            Enabled
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Reminder after (hours)
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={policy.reminderAfterHours}
              onChange={(event) =>
                setPolicy({
                  ...policy,
                  reminderAfterHours: Number(event.target.value),
                })
              }
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Overdue after (hours)
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={policy.overdueAfterHours}
              onChange={(event) =>
                setPolicy({
                  ...policy,
                  overdueAfterHours: Number(event.target.value),
                })
              }
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Escalation after (hours, optional)
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={policy.escalationAfterHours ?? ""}
              onChange={(event) =>
                setPolicy({
                  ...policy,
                  escalationAfterHours: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
              style={inputStyle}
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            style={{
              justifySelf: "start",
              padding: "0.5rem 0.85rem",
              border: "none",
              borderRadius: 6,
              background: "var(--forge-primary)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {saving ? "Saving..." : "Save SLA policy"}
          </button>
        </form>
      )}
    </section>
  );
}
