"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useCallback, useEffect, useState } from "react";
import type {
  ExperimentDetailResponseDto,
  ExperimentRunSummaryDto,
  ReviewerListResponseDto,
} from "@retailer-search/shared-types";
import { AnnotationPanel } from "./annotation-panel";
import { CommentsPanel } from "./comments-panel";
import { ADMIN_REVIEWER_STORAGE_KEY } from "./reviewer-management-panel";

function getExperimentRunTargetId(run: ExperimentRunSummaryDto): string {
  return `${run.experimentId}::${run.runAt}`;
}

const OUTCOME_COLORS: Record<string, string> = {
  improved: "#15803d",
  regressed: "#b91c1c",
  unchanged: "#64748b",
  changed: "#b45309",
};

const OUTCOME_BACKGROUNDS: Record<string, string> = {
  improved: "#f0fdf4",
  regressed: "#fef2f2",
  unchanged: "#fff",
  changed: "#fffbeb",
};

const OUTCOME_BORDERS: Record<string, string> = {
  improved: "#86efac",
  regressed: "#fecaca",
  unchanged: "#e2e8f0",
  changed: "#fde68a",
};

function getOutcomeLabel(result: ExperimentRunSummaryDto["results"][number]) {
  const baselineExpected = result.expectedMatchesInTopBaseline;
  const candidateExpected = result.expectedMatchesInTopCandidate;

  if (
    baselineExpected !== undefined &&
    candidateExpected !== undefined &&
    candidateExpected > baselineExpected
  ) {
    return "improved";
  }

  if (
    baselineExpected !== undefined &&
    candidateExpected !== undefined &&
    candidateExpected < baselineExpected
  ) {
    return "regressed";
  }

  if (!result.changed) {
    return "unchanged";
  }

  return "changed";
}

export function ExperimentRunView() {
  const [run, setRun] = useState<ExperimentRunSummaryDto | null>(null);
  const [experimentDetail, setExperimentDetail] =
    useState<ExperimentDetailResponseDto | null>(null);
  const [checkingShip, setCheckingShip] = useState(false);
  const [actorId, setActorId] = useState("local-reviewer");
  const [actorLabel, setActorLabel] = useState("Local Reviewer");
  const [selectedQueryAnchor, setSelectedQueryAnchor] = useState("query: drill");

  useEffect(() => {
    const loadActor = async () => {
      try {
        const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/reviewers`, {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as ReviewerListResponseDto;
        const storedActorId = window.localStorage.getItem(ADMIN_REVIEWER_STORAGE_KEY);
        const reviewer =
          body.reviewers.find(
            (entry) => entry.id === storedActorId && entry.active,
          ) ?? body.reviewers.find((entry) => entry.active);

        if (reviewer) {
          setActorId(reviewer.id);
          setActorLabel(reviewer.name);
        }
      } catch {
        // keep defaults
      }
    };

    void loadActor();
  }, []);

  const loadExperimentDetail = useCallback(async (experimentId: string) => {
    setCheckingShip(true);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/experiments/${experimentId}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        setExperimentDetail(null);
        return;
      }

      setExperimentDetail(
        (await response.json()) as ExperimentDetailResponseDto,
      );
    } catch {
      setExperimentDetail(null);
    } finally {
      setCheckingShip(false);
    }
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<ExperimentRunSummaryDto>;
      setRun(custom.detail);
      void loadExperimentDetail(custom.detail.experimentId);
    };

    window.addEventListener("admin:experiment-run", handler);
    return () => window.removeEventListener("admin:experiment-run", handler);
  }, [loadExperimentDetail]);

  const prefillPromotion = () => {
    if (!experimentDetail) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("admin:promote-prefill", {
        detail: {
          snapshotId: experimentDetail.experiment.candidateSnapshotId,
          sourceExperimentId: experimentDetail.experiment.id,
          reason:
            experimentDetail.decision?.rationale ??
            "Approved after experiment scorecard and ship decision.",
        },
      }),
    );
  };

  const canPromoteCandidate =
    experimentDetail?.decision?.decision === "ship" && Boolean(run);

  if (!run) {
    return (
      <section
        style={{
          padding: "1rem",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#fff",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>
          Experiment results
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
          Step 2: run an experiment to see baseline vs candidate evaluation
          results here, then generate a scorecard below.
        </p>
      </section>
    );
  }

  const sortedResults = [...run.results].sort((left, right) => {
    const priority = (result: ExperimentRunSummaryDto["results"][number]) => {
      const outcome = getOutcomeLabel(result);
      if (outcome === "regressed") {
        return 0;
      }
      if (outcome === "improved") {
        return 1;
      }
      if (outcome === "changed") {
        return 2;
      }
      return 3;
    };

    return priority(left) - priority(right);
  });

  return (
    <section
      style={{
        padding: "1rem",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "0.75rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Experiment results</h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: 12, color: "#64748b" }}>
            Experiment {run.experimentId}
          </p>
        </div>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          {new Date(run.runAt).toLocaleString()}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "0.5rem",
          marginBottom: "1rem",
          fontSize: 13,
        }}
      >
        <span style={{ color: "#475569" }}>Total {run.summary.totalQueries}</span>
        <span style={{ color: "#b45309" }}>
          Changed {run.summary.changedQueries}
        </span>
        <span style={{ color: "#15803d", fontWeight: 600 }}>
          Improved {run.summary.improvedQueries}
        </span>
        <span style={{ color: "#b91c1c", fontWeight: 600 }}>
          Regressed {run.summary.regressedQueries}
        </span>
        <span style={{ color: "#64748b" }}>
          Unchanged {run.summary.unchangedQueries}
        </span>
      </div>

      {experimentDetail && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            background: "#f8fafc",
            fontSize: 13,
          }}
        >
          <strong>Promotion readiness</strong>
          <p style={{ margin: "0.35rem 0", color: "#64748b" }}>
            Candidate snapshot:{" "}
            {experimentDetail.experiment.candidateSnapshotId}
            {experimentDetail.decision
              ? ` · decision: ${experimentDetail.decision.decision}`
              : " · no decision saved yet"}
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void loadExperimentDetail(run.experimentId)}
              disabled={checkingShip}
              style={{
                padding: "0.4rem 0.7rem",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                background: "#fff",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {checkingShip ? "Checking..." : "Refresh ship status"}
            </button>
            {canPromoteCandidate && (
              <button
                type="button"
                onClick={prefillPromotion}
                style={{
                  padding: "0.4rem 0.7rem",
                  border: "none",
                  borderRadius: 6,
                  background: "#15803d",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Promote candidate snapshot
              </button>
            )}
          </div>
        </div>
      )}

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: "0.65rem",
        }}
      >
        {sortedResults.map((result) => {
          const outcome = getOutcomeLabel(result);
          return (
            <li
              key={result.query}
              style={{
                padding: "0.75rem",
                border: `1px solid ${OUTCOME_BORDERS[outcome]}`,
                borderRadius: 8,
                background: OUTCOME_BACKGROUNDS[outcome],
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
                <strong>{result.query}</strong>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: OUTCOME_COLORS[outcome],
                    textTransform: "uppercase",
                    padding: "0.1rem 0.35rem",
                    borderRadius: 4,
                    background: "#fff",
                    border: `1px solid ${OUTCOME_BORDERS[outcome]}`,
                  }}
                >
                  {outcome}
                </span>
              </div>

              <p style={{ margin: "0 0 0.35rem", color: "#64748b" }}>
                Baseline {result.totalBaseline} results · Candidate{" "}
                {result.totalCandidate} results · Overlap {result.overlapCount}
              </p>

              {(result.expectedMatchesInTopBaseline !== undefined ||
                result.expectedMatchesInTopCandidate !== undefined) && (
                <p style={{ margin: "0 0 0.35rem", color: "#475569" }}>
                  Expected matches in top 10: baseline{" "}
                  <strong>{result.expectedMatchesInTopBaseline ?? 0}</strong> ·
                  candidate{" "}
                  <strong>{result.expectedMatchesInTopCandidate ?? 0}</strong>
                  {outcome === "improved" && " · candidate wins"}
                  {outcome === "regressed" && " · candidate loses"}
                </p>
              )}

              <p style={{ margin: "0 0 0.35rem", color: "#334155" }}>
                Top baseline: {result.topBaselineIds.join(", ") || "none"}
              </p>
              <p style={{ margin: 0, color: "#334155" }}>
                Top candidate: {result.topCandidateIds.join(", ") || "none"}
              </p>

              {result.notes && (
                <p style={{ margin: "0.5rem 0 0", color: "#64748b" }}>
                  {result.notes}
                </p>
              )}

              <button
                type="button"
                onClick={() => setSelectedQueryAnchor(`query: ${result.query}`)}
                style={{
                  marginTop: "0.5rem",
                  padding: "0.25rem 0.5rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                Annotate this query
              </button>
            </li>
          );
        })}
      </ul>

      <div
        style={{
          marginTop: "1rem",
          paddingTop: "1rem",
          borderTop: "1px solid #e2e8f0",
        }}
      >
        <h3 style={{ margin: "0 0 0.75rem", fontSize: 14 }}>
          Experiment collaboration
        </h3>
        <CommentsPanel
          targetType="experiment"
          targetId={run.experimentId}
          actorId={actorId}
          actorLabel={actorLabel}
          title="Experiment discussion"
        />
        <CommentsPanel
          targetType="experiment_run"
          targetId={getExperimentRunTargetId(run)}
          actorId={actorId}
          actorLabel={actorLabel}
          title="Run discussion"
        />
        <AnnotationPanel
          targetType="experiment_run"
          targetId={getExperimentRunTargetId(run)}
          actorId={actorId}
          actorLabel={actorLabel}
          title="Run annotations"
          defaultAnchorLabel={selectedQueryAnchor}
        />
      </div>
    </section>
  );
}
