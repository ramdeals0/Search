"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CreateDelegationRuleRequestDto,
  DelegationListResponseDto,
  DelegationMode,
  DelegationRuleDto,
  ReviewerDto,
  ReviewerListResponseDto,
} from "@retailer-search/shared-types";
import { ADMIN_APPROVALS_CHANGED_EVENT } from "./approval-panel";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

export const ADMIN_DELEGATION_CHANGED_EVENT = "admin:delegation-changed";

const inputStyle = {
  padding: "0.45rem 0.6rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 13,
  width: "100%",
} as const;

export function DelegationPanel() {
  const [rules, setRules] = useState<DelegationRuleDto[]>([]);
  const [reviewers, setReviewers] = useState<ReviewerDto[]>([]);
  const [fromReviewerId, setFromReviewerId] = useState("");
  const [toReviewerId, setToReviewerId] = useState("");
  const [mode, setMode] = useState<DelegationMode>("delegate");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadPanelData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [delegationsRes, reviewersRes] = await Promise.all([
        fetch(`${SEARCH_API_URL}/api/v1/admin/delegations`, { cache: "no-store" }),
        fetch(`${SEARCH_API_URL}/api/v1/admin/reviewers`, { cache: "no-store" }),
      ]);

      if (!delegationsRes.ok || !reviewersRes.ok) {
        throw new Error("Failed to load delegation data");
      }

      const delegationsData =
        (await delegationsRes.json()) as DelegationListResponseDto;
      const reviewersData = (await reviewersRes.json()) as ReviewerListResponseDto;

      setRules(delegationsData.rules);
      setReviewers(reviewersData.reviewers.filter((reviewer) => reviewer.active));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load delegations",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPanelData();
  }, [loadPanelData]);

  const notifyChanged = () => {
    window.dispatchEvent(new CustomEvent(ADMIN_DELEGATION_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent(ADMIN_APPROVALS_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent("admin:notifications-changed"));
  };

  const createRule = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!fromReviewerId || !toReviewerId) {
      setError("From and to reviewers are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    const payload: CreateDelegationRuleRequestDto = {
      fromReviewerId,
      toReviewerId,
      mode,
      reason: reason.trim() || undefined,
      startAt: startAt ? new Date(startAt).toISOString() : undefined,
      endAt: endAt ? new Date(endAt).toISOString() : undefined,
    };

    try {
      const response = await fetch(`${SEARCH_API_URL}/api/v1/admin/delegations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Create delegation failed with HTTP ${response.status}`);
      }

      setFeedback("Delegation rule created.");
      setFromReviewerId("");
      setToReviewerId("");
      setStartAt("");
      setEndAt("");
      setReason("");
      await loadPanelData();
      notifyChanged();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Failed to create delegation",
      );
    } finally {
      setSaving(false);
    }
  };

  const deactivateRule = async (id: string) => {
    setActingOnId(id);
    setError(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/delegations/${id}/deactivate`,
        { method: "POST" },
      );

      if (!response.ok) {
        throw new Error(`Deactivate failed with HTTP ${response.status}`);
      }

      setFeedback("Delegation rule deactivated.");
      await loadPanelData();
      notifyChanged();
    } catch (deactivateError) {
      setError(
        deactivateError instanceof Error
          ? deactivateError.message
          : "Failed to deactivate delegation",
      );
    } finally {
      setActingOnId(null);
    }
  };

  const reviewerName = (id: string) =>
    reviewers.find((reviewer) => reviewer.id === id)?.name ?? id;

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
        Reviewer delegation
      </h2>

      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Delegate adds a backup approver while keeping the original assignment visible.
        Reassign moves ownership to another reviewer when the rule is active.
      </p>

      {error && (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 13 }}>{error}</p>
      )}
      {feedback && (
        <p style={{ margin: "0 0 0.75rem", color: "#15803d", fontSize: 13 }}>{feedback}</p>
      )}

      <form
        onSubmit={(event) => void createRule(event)}
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
        <strong style={{ fontSize: 14 }}>Create delegation rule</strong>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          From reviewer
          <select
            required
            value={fromReviewerId}
            onChange={(event) => setFromReviewerId(event.target.value)}
            style={inputStyle}
          >
            <option value="">Select reviewer</option>
            {reviewers.map((reviewer) => (
              <option key={reviewer.id} value={reviewer.id}>
                {reviewer.name} ({reviewer.role})
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          To reviewer
          <select
            required
            value={toReviewerId}
            onChange={(event) => setToReviewerId(event.target.value)}
            style={inputStyle}
          >
            <option value="">Select reviewer</option>
            {reviewers.map((reviewer) => (
              <option key={reviewer.id} value={reviewer.id}>
                {reviewer.name} ({reviewer.role})
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Mode
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as DelegationMode)}
            style={inputStyle}
          >
            <option value="delegate">Delegate (backup approver)</option>
            <option value="reassign">Reassign (move ownership)</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Start (optional)
          <input
            type="datetime-local"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          End (optional)
          <input
            type="datetime-local"
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Reason
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Out of office, workload balancing, etc."
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
            background: "#0f172a",
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {saving ? "Saving..." : "Create rule"}
        </button>
      </form>

      {loading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Loading rules...</p>
      )}

      {!loading && rules.length === 0 && (
        <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>No delegation rules yet.</p>
      )}

      {!loading && rules.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.55rem" }}>
          {rules.map((rule) => (
            <li
              key={rule.id}
              style={{
                padding: "0.7rem",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: 4 }}>
                <strong>
                  {reviewerName(rule.fromReviewerId)} → {reviewerName(rule.toReviewerId)}
                </strong>
                <span style={{ color: rule.active ? "#15803d" : "#64748b" }}>
                  {rule.active ? "active" : "inactive"}
                </span>
                <span style={{ color: "#64748b" }}>{rule.mode}</span>
              </div>
              <p style={{ margin: "0 0 0.35rem", color: "#64748b" }}>
                {rule.reason ?? "No reason provided"}
              </p>
              <p style={{ margin: "0 0 0.35rem", color: "#94a3b8" }}>
                Window: {rule.startAt ? new Date(rule.startAt).toLocaleString() : "now"} –{" "}
                {rule.endAt ? new Date(rule.endAt).toLocaleString() : "open-ended"}
              </p>
              {rule.active && (
                <button
                  type="button"
                  disabled={actingOnId === rule.id}
                  onClick={() => void deactivateRule(rule.id)}
                  style={{
                    padding: "0.35rem 0.65rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {actingOnId === rule.id ? "Deactivating..." : "Deactivate"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
