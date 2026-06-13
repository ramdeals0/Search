"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useCallback, useEffect, useState } from "react";
import type {
  ExperimentDecisionDto,
  ExperimentDecisionStatus,
  ExperimentRunSummaryDto,
} from "@retailer-search/shared-types";

const DECISION_OPTIONS: {
  value: ExperimentDecisionStatus;
  label: string;
  hint: string;
}[] = [
  {
    value: "ship",
    label: "Ship",
    hint: "Approve candidate conceptually for rollout.",
  },
  {
    value: "iterate",
    label: "Iterate",
    hint: "Keep candidate and continue tuning.",
  },
  {
    value: "rollback",
    label: "Rollback",
    hint: "Do not proceed; revert to baseline.",
  },
  {
    value: "undecided",
    label: "Undecided",
    hint: "No final call yet.",
  },
];

const textareaStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
  minHeight: 80,
  resize: "vertical" as const,
  fontFamily: "inherit",
};

export function DecisionPanel() {
  const [experimentId, setExperimentId] = useState<string | null>(null);
  const [decision, setDecision] = useState<ExperimentDecisionDto | null>(null);
  const [selectedDecision, setSelectedDecision] =
    useState<ExperimentDecisionStatus>("undecided");
  const [rationale, setRationale] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadDecision = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/experiments/${id}/decision`,
        { cache: "no-store" },
      );

      if (response.status === 404) {
        setDecision(null);
        setSelectedDecision("undecided");
        setRationale("");
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load decision: HTTP ${response.status}`);
      }

      const existing = (await response.json()) as ExperimentDecisionDto;
      setDecision(existing);
      setSelectedDecision(existing.decision);
      setRationale(existing.rationale);
    } catch (loadError) {
      setDecision(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load decision",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<ExperimentRunSummaryDto>;
      const id = custom.detail.experimentId;
      setExperimentId(id);
      setFeedback(null);
      void loadDecision(id);
    };

    window.addEventListener("admin:experiment-run", handler);
    return () => window.removeEventListener("admin:experiment-run", handler);
  }, [loadDecision]);

  const saveDecision = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!experimentId) {
      return;
    }

    const trimmedRationale = rationale.trim();
    if (!trimmedRationale) {
      setError("Rationale is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/experiments/${experimentId}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: selectedDecision,
            rationale: trimmedRationale,
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          body?.error ?? `Save decision failed with HTTP ${response.status}`,
        );
      }

      const saved = (await response.json()) as ExperimentDecisionDto;
      setDecision(saved);
      setFeedback(`Saved ${saved.decision} decision.`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save decision",
      );
    } finally {
      setSaving(false);
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
        Ship / iterate / rollback decision
      </h2>

      <p style={{ margin: "0 0 0.75rem", fontSize: 13, color: "#64748b" }}>
        Step 4: record an explicit governance decision with rationale. This does
        not auto-promote snapshots in MVP.
      </p>

      {!experimentId && (
        <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
          Run an experiment first to record a decision.
        </p>
      )}

      {experimentId && loading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Loading decision...
        </p>
      )}

      {decision && (
        <div
          style={{
            marginBottom: "0.85rem",
            padding: "0.65rem 0.75rem",
            borderRadius: 6,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            fontSize: 13,
          }}
        >
          <strong>Current decision:</strong> {decision.decision}
          <p style={{ margin: "0.35rem 0 0", color: "#64748b" }}>
            {decision.rationale}
          </p>
          <p style={{ margin: "0.35rem 0 0", color: "#94a3b8", fontSize: 12 }}>
            Saved {new Date(decision.decidedAt).toLocaleString()}
            {decision.linkedRunAt &&
              ` · linked to run ${new Date(decision.linkedRunAt).toLocaleString()}`}
          </p>
        </div>
      )}

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

      {experimentId && !loading && (
        <form
          onSubmit={(event) => void saveDecision(event)}
          style={{ display: "grid", gap: "0.75rem" }}
        >
          <fieldset
            style={{
              margin: 0,
              padding: 0,
              border: "none",
              display: "grid",
              gap: "0.5rem",
            }}
          >
            <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Decision
            </legend>
            {DECISION_OPTIONS.map((option) => (
              <label
                key={option.value}
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "flex-start",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="experiment-decision"
                  value={option.value}
                  checked={selectedDecision === option.value}
                  onChange={() => setSelectedDecision(option.value)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <span style={{ color: "#64748b" }}> — {option.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Rationale
            <textarea
              required
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              placeholder="Why ship, iterate, rollback, or stay undecided?"
              style={textareaStyle}
            />
          </label>

          <button
            type="submit"
            disabled={saving}
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
            {saving ? "Saving..." : "Save decision"}
          </button>
        </form>
      )}
    </section>
  );
}
