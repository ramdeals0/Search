"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useCallback, useEffect, useState } from "react";
import type {
  EvaluationQuerySetDto,
  ExperimentDto,
  ExperimentRunSummaryDto,
  MerchandisingConfigSnapshotDto,
} from "@retailer-search/shared-types";

const inputStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
} as const;

export function ExperimentsPanel() {
  const [experiments, setExperiments] = useState<ExperimentDto[]>([]);
  const [snapshots, setSnapshots] = useState<MerchandisingConfigSnapshotDto[]>(
    [],
  );
  const [querySets, setQuerySets] = useState<EvaluationQuerySetDto[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baselineSnapshotId, setBaselineSnapshotId] = useState("");
  const [candidateSnapshotId, setCandidateSnapshotId] = useState("");
  const [querySetId, setQuerySetId] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [experimentsRes, snapshotsRes, querySetsRes] = await Promise.all([
        fetch(`${getSearchApiUrl()}/api/v1/admin/experiments`, { cache: "no-store" }),
        fetch(`${getSearchApiUrl()}/api/v1/admin/snapshots`, { cache: "no-store" }),
        fetch(`${getSearchApiUrl()}/api/v1/admin/query-sets`, { cache: "no-store" }),
      ]);

      if (!experimentsRes.ok || !snapshotsRes.ok || !querySetsRes.ok) {
        throw new Error("Failed to load experiment resources");
      }

      const experimentsData = (await experimentsRes.json()) as {
        experiments: ExperimentDto[];
      };
      const snapshotsData = (await snapshotsRes.json()) as {
        snapshots: MerchandisingConfigSnapshotDto[];
      };
      const querySetsData = (await querySetsRes.json()) as {
        querySets: EvaluationQuerySetDto[];
      };

      setExperiments(experimentsData.experiments);
      setSnapshots(snapshotsData.snapshots);
      setQuerySets(querySetsData.querySets);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load experiments",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const handler = () => {
      void loadData();
    };
    window.addEventListener("admin:query-set-created", handler);
    return () => window.removeEventListener("admin:query-set-created", handler);
  }, [loadData]);

  const createExperiment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !baselineSnapshotId || !candidateSnapshotId || !querySetId) {
      return;
    }

    setCreating(true);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/experiments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          baselineSnapshotId,
          candidateSnapshotId,
          querySetId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Create experiment failed with HTTP ${response.status}`);
      }

      setName("");
      setDescription("");
      setFeedback("Experiment created.");
      await loadData();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create experiment",
      );
    } finally {
      setCreating(false);
    }
  };

  const runExperiment = async (experiment: ExperimentDto) => {
    setRunningId(experiment.id);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/experiments/${experiment.id}/run`,
        { method: "POST" },
      );

      if (!response.ok) {
        throw new Error(`Run experiment failed with HTTP ${response.status}`);
      }

      const run = (await response.json()) as ExperimentRunSummaryDto;
      setFeedback(`Ran experiment '${experiment.name}'.`);
      window.dispatchEvent(
        new CustomEvent("admin:experiment-run", { detail: run }),
      );
      await loadData();
    } catch (runError) {
      setError(
        runError instanceof Error ? runError.message : "Failed to run experiment",
      );
    } finally {
      setRunningId(null);
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
      <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>Experiments</h2>

      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Compare baseline and candidate snapshots across a saved query set before
        keeping or rolling back configuration changes.
      </p>

      <form
        onSubmit={(event) => void createExperiment(event)}
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
        <strong style={{ fontSize: 14 }}>Create experiment</strong>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Drill ranking comparison"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Description (optional)
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            style={inputStyle}
          />
        </label>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Baseline snapshot
            <select
              required
              value={baselineSnapshotId}
              onChange={(event) => setBaselineSnapshotId(event.target.value)}
              style={inputStyle}
            >
              <option value="">Select snapshot</option>
              {snapshots.map((snapshot) => (
                <option key={`base-${snapshot.id}`} value={snapshot.id}>
                  {snapshot.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Candidate snapshot
            <select
              required
              value={candidateSnapshotId}
              onChange={(event) => setCandidateSnapshotId(event.target.value)}
              style={inputStyle}
            >
              <option value="">Select snapshot</option>
              {snapshots.map((snapshot) => (
                <option key={`cand-${snapshot.id}`} value={snapshot.id}>
                  {snapshot.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Query set
            <select
              required
              value={querySetId}
              onChange={(event) => setQuerySetId(event.target.value)}
              style={inputStyle}
            >
              <option value="">Select query set</option>
              {querySets.map((querySet) => (
                <option key={querySet.id} value={querySet.id}>
                  {querySet.name} ({querySet.queries.length})
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={creating || snapshots.length === 0 || querySets.length === 0}
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
          {creating ? "Creating..." : "Create experiment"}
        </button>
      </form>

      {feedback && (
        <p style={{ margin: "0 0 1rem", color: "#15803d", fontSize: 13 }}>
          {feedback}
        </p>
      )}
      {error && (
        <p style={{ margin: "0 0 1rem", color: "#b91c1c", fontSize: 13 }}>
          {error}
        </p>
      )}

      {loading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Loading experiments...
        </p>
      )}

      {!loading && experiments.length === 0 && (
        <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
          No experiments yet. Create snapshots and a query set first.
        </p>
      )}

      {!loading && experiments.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: "0.65rem",
          }}
        >
          {experiments.map((experiment) => (
            <li
              key={experiment.id}
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
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                  marginBottom: "0.35rem",
                }}
              >
                <strong>{experiment.name}</strong>
                <span style={{ color: "#64748b" }}>{experiment.status}</span>
              </div>
              <p style={{ margin: "0 0 0.5rem", color: "#64748b" }}>
                {experiment.lastRunAt
                  ? `Last run ${new Date(experiment.lastRunAt).toLocaleString()}`
                  : "Not run yet"}
              </p>
              <button
                type="button"
                onClick={() => void runExperiment(experiment)}
                disabled={runningId === experiment.id}
                style={{
                  padding: "0.4rem 0.7rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {runningId === experiment.id ? "Running..." : "Run experiment"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
