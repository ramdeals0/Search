import type {
  ExperimentRunSummaryDto,
  ExperimentScorecardDto,
  ScorecardMetricDto,
} from "@retailer-search/shared-types";

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export function buildExperimentScorecard(
  run: ExperimentRunSummaryDto,
): ExperimentScorecardDto {
  const { summary } = run;
  const totalQueries = summary.totalQueries;
  const improvementRate = rate(summary.improvedQueries, totalQueries);
  const regressionRate = rate(summary.regressedQueries, totalQueries);

  const guardrailFindings: string[] = [];
  let headlineStatus: ExperimentScorecardDto["headlineStatus"];

  if (regressionRate === 0 && summary.improvedQueries >= 1) {
    headlineStatus = "pass";
    guardrailFindings.push(
      `No regressions detected across ${totalQueries} queries.`,
    );
    guardrailFindings.push(
      `${summary.improvedQueries} quer${summary.improvedQueries === 1 ? "y" : "ies"} improved vs baseline.`,
    );
  } else if (
    summary.regressedQueries >= summary.improvedQueries &&
    summary.regressedQueries > 0
  ) {
    headlineStatus = "fail";
    guardrailFindings.push(
      `${summary.regressedQueries} quer${summary.regressedQueries === 1 ? "y" : "ies"} regressed, exceeding the safe rollout threshold.`,
    );
    if (summary.improvedQueries > 0) {
      guardrailFindings.push(
        `${summary.improvedQueries} quer${summary.improvedQueries === 1 ? "y" : "ies"} improved, but regressions outweigh gains.`,
      );
    }
  } else {
    headlineStatus = "review";
    guardrailFindings.push(
      "Results are mixed and need human review before shipping.",
    );
    if (summary.regressedQueries > 0) {
      guardrailFindings.push(
        `${summary.regressedQueries} quer${summary.regressedQueries === 1 ? "y" : "ies"} regressed.`,
      );
    }
    if (summary.improvedQueries === 0) {
      guardrailFindings.push("No query-level improvements were detected.");
    }
  }

  const metrics: ScorecardMetricDto[] = [
    {
      key: "totalQueries",
      label: "Total queries",
      value: summary.totalQueries,
      status: "neutral",
      description: "Number of evaluation queries in the run.",
    },
    {
      key: "changedQueries",
      label: "Changed queries",
      value: summary.changedQueries,
      status: summary.changedQueries > 0 ? "warning" : "neutral",
      description: "Queries where baseline and candidate differed.",
    },
    {
      key: "improvedQueries",
      label: "Improved queries",
      value: summary.improvedQueries,
      status: summary.improvedQueries >= 1 ? "good" : "neutral",
      description: "Queries with more expected matches in top results.",
    },
    {
      key: "regressedQueries",
      label: "Regressed queries",
      value: summary.regressedQueries,
      status: summary.regressedQueries > 0 ? "bad" : "good",
      description: "Queries with fewer expected matches in top results.",
    },
    {
      key: "improvementRate",
      label: "Improvement rate",
      value: Number(improvementRate.toFixed(3)),
      status:
        improvementRate >= 0.25
          ? "good"
          : improvementRate > 0
            ? "warning"
            : "neutral",
      description: "Share of queries that improved vs baseline.",
    },
    {
      key: "regressionRate",
      label: "Regression rate",
      value: Number(regressionRate.toFixed(3)),
      status: regressionRate === 0 ? "good" : regressionRate > 0 ? "bad" : "neutral",
      description: "Share of queries that regressed vs baseline.",
    },
    {
      key: "unchangedQueries",
      label: "Unchanged queries",
      value: summary.unchangedQueries,
      status: "neutral",
      description: "Queries with identical baseline and candidate outcomes.",
    },
  ];

  const summaryText =
    headlineStatus === "pass"
      ? `Candidate passes guardrails with ${formatPercent(improvementRate)} improvement rate and zero regressions.`
      : headlineStatus === "fail"
        ? `Candidate fails guardrails with ${summary.regressedQueries} regression${summary.regressedQueries === 1 ? "" : "s"} across ${totalQueries} queries.`
        : `Candidate needs review with ${summary.improvedQueries} improvement${summary.improvedQueries === 1 ? "" : "s"} and ${summary.regressedQueries} regression${summary.regressedQueries === 1 ? "" : "s"}.`;

  return {
    experimentId: run.experimentId,
    generatedAt: new Date().toISOString(),
    headlineStatus,
    metrics,
    summary: summaryText,
    guardrailFindings,
  };
}
