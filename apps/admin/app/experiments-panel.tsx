"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useCallback, useEffect, useState } from "react";
import type {
  EvaluationQuerySetDto,
  ExperimentArmAiConfigDto,
  ExperimentDto,
  ExperimentLlmOverridesDto,
  ExperimentRunSummaryDto,
  MerchandisingConfigSnapshotDto,
  OnlineExperimentStatusDto,
} from "@retailer-search/shared-types";

const inputStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
} as const;

const AI_WEIGHT_PRESETS = {
  balanced: {
    label: "Balanced (default)",
    weights: { lexicalWeight: 0.55, semanticWeight: 0.3, personalizationWeight: 0.15 },
  },
  semantic_heavy: {
    label: "Semantic-heavy",
    weights: { lexicalWeight: 0.35, semanticWeight: 0.5, personalizationWeight: 0.15 },
  },
  personalization_heavy: {
    label: "Personalization-heavy",
    weights: { lexicalWeight: 0.45, semanticWeight: 0.25, personalizationWeight: 0.3 },
  },
  lexical_dominant: {
    label: "Lexical-dominant",
    weights: { lexicalWeight: 0.7, semanticWeight: 0.2, personalizationWeight: 0.1 },
  },
} as const;

type AiWeightPresetKey = keyof typeof AI_WEIGHT_PRESETS;

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
  const [llmQueryRewrite, setLlmQueryRewrite] = useState(false);
  const [llmZeroResults, setLlmZeroResults] = useState(false);
  const [llmRerank, setLlmRerank] = useState(false);
  const [aiSemanticEnabled, setAiSemanticEnabled] = useState(false);
  const [aiPersonalizationEnabled, setAiPersonalizationEnabled] = useState(false);
  const [aiWeightPreset, setAiWeightPreset] = useState<AiWeightPresetKey | "">("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [savingOnlineId, setSavingOnlineId] = useState<string | null>(null);
  const [onlineDrafts, setOnlineDrafts] = useState<
    Record<string, { onlineEnabled: boolean; onlineTrafficPercent: number }>
  >({});
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
      setOnlineDrafts(
        Object.fromEntries(
          experimentsData.experiments.map((experiment) => [
            experiment.id,
            {
              onlineEnabled: experiment.onlineEnabled ?? false,
              onlineTrafficPercent: experiment.onlineTrafficPercent ?? 10,
            },
          ]),
        ),
      );
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
      const candidateLlmOverrides: ExperimentLlmOverridesDto | undefined =
        llmQueryRewrite || llmZeroResults || llmRerank
          ? {
              queryRewriteEnabled: llmQueryRewrite || undefined,
              zeroResultsEnabled: llmZeroResults || undefined,
              rerankEnabled: llmRerank || undefined,
            }
          : undefined;

      const candidateAiConfig: ExperimentArmAiConfigDto | undefined =
        aiSemanticEnabled || aiPersonalizationEnabled || aiWeightPreset
          ? {
              semanticRetrievalEnabled: aiSemanticEnabled || undefined,
              personalizationEnabled: aiPersonalizationEnabled || undefined,
              weights: aiWeightPreset
                ? AI_WEIGHT_PRESETS[aiWeightPreset].weights
                : undefined,
            }
          : undefined;

      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/experiments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          baselineSnapshotId,
          candidateSnapshotId,
          querySetId,
          candidateLlmOverrides,
          candidateAiConfig,
        }),
      });

      if (!response.ok) {
        throw new Error(`Create experiment failed with HTTP ${response.status}`);
      }

      setName("");
      setDescription("");
      setLlmQueryRewrite(false);
      setLlmZeroResults(false);
      setLlmRerank(false);
      setAiSemanticEnabled(false);
      setAiPersonalizationEnabled(false);
      setAiWeightPreset("");
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

  const updateOnlineSettings = async (experiment: ExperimentDto) => {
    const draft = onlineDrafts[experiment.id] ?? {
      onlineEnabled: experiment.onlineEnabled ?? false,
      onlineTrafficPercent: experiment.onlineTrafficPercent ?? 10,
    };

    setSavingOnlineId(experiment.id);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/experiments/${experiment.id}/online`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            onlineEnabled: draft.onlineEnabled,
            onlineTrafficPercent: draft.onlineTrafficPercent,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to update online status (${response.status})`);
      }
      const payload = (await response.json()) as OnlineExperimentStatusDto;
      setFeedback(
        payload.onlineEnabled
          ? `Enabled online A/B for '${experiment.name}' at ${payload.trafficPercent}% traffic.`
          : `Disabled online A/B for '${experiment.name}'.`,
      );
      await loadData();
    } catch (onlineError) {
      setError(
        onlineError instanceof Error ? onlineError.message : "Failed to update online status",
      );
    } finally {
      setSavingOnlineId(null);
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

        <fieldset
          style={{
            margin: 0,
            padding: "0.65rem 0.75rem",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
          }}
        >
          <legend style={{ fontSize: 13, padding: "0 0.25rem" }}>
            Candidate LLM overrides (optional)
          </legend>
          <p style={{ margin: "0 0 0.5rem", fontSize: 12, color: "#64748b" }}>
            Enable LLM features on the candidate arm only. Baseline stays on
            standard search.
          </p>
          <div style={{ display: "grid", gap: "0.35rem", fontSize: 13 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={llmQueryRewrite}
                onChange={(event) => setLlmQueryRewrite(event.target.checked)}
              />
              Query rewrite
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={llmZeroResults}
                onChange={(event) => setLlmZeroResults(event.target.checked)}
              />
              Zero-results recovery
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={llmRerank}
                onChange={(event) => setLlmRerank(event.target.checked)}
              />
              LLM rerank (page 1)
            </label>
          </div>
        </fieldset>

        <fieldset
          style={{
            margin: 0,
            padding: "0.65rem 0.75rem",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
          }}
        >
          <legend style={{ fontSize: 13, padding: "0 0.25rem" }}>
            Candidate AI config (optional)
          </legend>
          <p style={{ margin: "0 0 0.5rem", fontSize: 12, color: "#64748b" }}>
            Override hybrid search settings on the candidate arm only. Baseline uses
            live AI search config.
          </p>
          <div style={{ display: "grid", gap: "0.5rem", fontSize: 13 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={aiSemanticEnabled}
                onChange={(event) => setAiSemanticEnabled(event.target.checked)}
              />
              Semantic retrieval on candidate
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={aiPersonalizationEnabled}
                onChange={(event) => setAiPersonalizationEnabled(event.target.checked)}
              />
              Personalization on candidate
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              Weight preset
              <select
                value={aiWeightPreset}
                onChange={(event) =>
                  setAiWeightPreset(event.target.value as AiWeightPresetKey | "")
                }
                style={inputStyle}
              >
                <option value="">Use live weights</option>
                {(Object.entries(AI_WEIGHT_PRESETS) as Array<
                  [AiWeightPresetKey, (typeof AI_WEIGHT_PRESETS)[AiWeightPresetKey]]
                >).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

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
              {experiment.candidateLlmOverrides ? (
                <p style={{ margin: "0 0 0.5rem", color: "#64748b" }}>
                  LLM candidate:{" "}
                  {[
                    experiment.candidateLlmOverrides.queryRewriteEnabled
                      ? "rewrite"
                      : null,
                    experiment.candidateLlmOverrides.zeroResultsEnabled
                      ? "zero-results"
                      : null,
                    experiment.candidateLlmOverrides.rerankEnabled
                      ? "rerank"
                      : null,
                  ]
                    .filter(Boolean)
                    .join(", ") || "none"}
                </p>
              ) : null}
              {experiment.candidateAiConfig ? (
                <p style={{ margin: "0 0 0.5rem", color: "#64748b" }}>
                  AI candidate:{" "}
                  {[
                    experiment.candidateAiConfig.semanticRetrievalEnabled
                      ? "semantic"
                      : null,
                    experiment.candidateAiConfig.personalizationEnabled
                      ? "personalization"
                      : null,
                    experiment.candidateAiConfig.weights
                      ? `weights L/S/P ${experiment.candidateAiConfig.weights.lexicalWeight?.toFixed(2) ?? "?"}/${experiment.candidateAiConfig.weights.semanticWeight?.toFixed(2) ?? "?"}/${experiment.candidateAiConfig.weights.personalizationWeight?.toFixed(2) ?? "?"}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(", ") || "none"}
                </p>
              ) : null}
              <div
                style={{
                  marginBottom: "0.65rem",
                  padding: "0.6rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  background: "#f8fafc",
                  display: "grid",
                  gap: "0.45rem",
                }}
              >
                <strong style={{ fontSize: 12 }}>Online A/B</strong>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={
                      onlineDrafts[experiment.id]?.onlineEnabled ??
                      (experiment.onlineEnabled ?? false)
                    }
                    onChange={(event) =>
                      setOnlineDrafts((current) => ({
                        ...current,
                        [experiment.id]: {
                          onlineEnabled: event.target.checked,
                          onlineTrafficPercent:
                            current[experiment.id]?.onlineTrafficPercent ??
                            experiment.onlineTrafficPercent ??
                            10,
                        },
                      }))
                    }
                  />
                  Enable online A/B
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  Traffic percent
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={
                      onlineDrafts[experiment.id]?.onlineTrafficPercent ??
                      (experiment.onlineTrafficPercent ?? 10)
                    }
                    onChange={(event) =>
                      setOnlineDrafts((current) => ({
                        ...current,
                        [experiment.id]: {
                          onlineEnabled:
                            current[experiment.id]?.onlineEnabled ??
                            (experiment.onlineEnabled ?? false),
                          onlineTrafficPercent: Number(event.target.value),
                        },
                      }))
                    }
                    style={inputStyle}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void updateOnlineSettings(experiment)}
                  disabled={savingOnlineId === experiment.id}
                  style={{
                    justifySelf: "start",
                    padding: "0.35rem 0.6rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {savingOnlineId === experiment.id ? "Saving..." : "Save online settings"}
                </button>
              </div>
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
