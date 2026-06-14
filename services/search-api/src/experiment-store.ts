import type {
  CreateExperimentRequestDto,
  CreateQuerySetRequestDto,
  EvaluationQuerySetDto,
  ExperimentDecisionDto,
  ExperimentDto,
  ExperimentRunSummaryDto,
  ExperimentScorecardDto,
  ExperimentStatus,
  SaveExperimentDecisionRequestDto,
} from "@retailer-search/shared-types";

const querySets: EvaluationQuerySetDto[] = [];
const experiments: ExperimentDto[] = [];
const experimentRuns = new Map<string, ExperimentRunSummaryDto>();
const experimentScorecards = new Map<string, ExperimentScorecardDto>();
const experimentDecisions = new Map<string, ExperimentDecisionDto>();

let querySetIdCounter = 1;
let experimentIdCounter = 1;

function createQuerySetId(): string {
  const id = `qset-${Date.now()}-${querySetIdCounter}`;
  querySetIdCounter += 1;
  return id;
}

function createExperimentId(): string {
  const id = `exp-${Date.now()}-${experimentIdCounter}`;
  experimentIdCounter += 1;
  return id;
}

export function createQuerySet(
  input: CreateQuerySetRequestDto,
): EvaluationQuerySetDto {
  const querySet: EvaluationQuerySetDto = {
    id: createQuerySetId(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    queries: input.queries.map((query) => ({
      query: query.query.trim(),
      expectedProductIds: query.expectedProductIds?.filter(Boolean),
      notes: query.notes?.trim() || undefined,
      tags: query.tags?.filter(Boolean),
    })),
    createdAt: new Date().toISOString(),
  };

  querySets.push(querySet);
  return structuredClone(querySet);
}

export function listQuerySets(): EvaluationQuerySetDto[] {
  return [...querySets]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((querySet) => structuredClone(querySet));
}

export function getQuerySetById(id: string): EvaluationQuerySetDto | undefined {
  const querySet = querySets.find((item) => item.id === id);
  return querySet ? structuredClone(querySet) : undefined;
}

export function createExperiment(
  input: CreateExperimentRequestDto,
): ExperimentDto {
  const experiment: ExperimentDto = {
    id: createExperimentId(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    status: "draft",
    baselineSnapshotId: input.baselineSnapshotId,
    candidateSnapshotId: input.candidateSnapshotId,
    querySetId: input.querySetId,
    candidateLlmOverrides: input.candidateLlmOverrides,
    createdAt: new Date().toISOString(),
  };

  experiments.push(experiment);
  return structuredClone(experiment);
}

export function listExperiments(): ExperimentDto[] {
  return [...experiments]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((experiment) => structuredClone(experiment));
}

export function getExperimentById(id: string): ExperimentDto | undefined {
  const experiment = experiments.find((item) => item.id === id);
  return experiment ? structuredClone(experiment) : undefined;
}

export function updateExperimentStatus(
  id: string,
  status: ExperimentStatus,
): ExperimentDto | undefined {
  const experiment = experiments.find((item) => item.id === id);
  if (!experiment) {
    return undefined;
  }

  experiment.status = status;
  return structuredClone(experiment);
}

export function saveExperimentRun(run: ExperimentRunSummaryDto): void {
  experimentRuns.set(run.experimentId, structuredClone(run));

  const experiment = experiments.find((item) => item.id === run.experimentId);
  if (experiment) {
    experiment.lastRunAt = run.runAt;
    experiment.status = "run";
  }
}

export function getLastExperimentRun(
  experimentId: string,
): ExperimentRunSummaryDto | undefined {
  const run = experimentRuns.get(experimentId);
  return run ? structuredClone(run) : undefined;
}

export function saveExperimentScorecard(
  experimentId: string,
  scorecard: ExperimentScorecardDto,
): ExperimentScorecardDto {
  experimentScorecards.set(experimentId, structuredClone(scorecard));
  return structuredClone(scorecard);
}

export function getExperimentScorecard(
  experimentId: string,
): ExperimentScorecardDto | undefined {
  const scorecard = experimentScorecards.get(experimentId);
  return scorecard ? structuredClone(scorecard) : undefined;
}

export function saveExperimentDecision(
  experimentId: string,
  input: SaveExperimentDecisionRequestDto,
  linkedRunAt?: string,
): ExperimentDecisionDto {
  const decision: ExperimentDecisionDto = {
    experimentId,
    decidedAt: new Date().toISOString(),
    decision: input.decision,
    rationale: input.rationale.trim(),
    linkedRunAt,
  };

  experimentDecisions.set(experimentId, decision);
  return structuredClone(decision);
}

export function getExperimentDecision(
  experimentId: string,
): ExperimentDecisionDto | undefined {
  const decision = experimentDecisions.get(experimentId);
  return decision ? structuredClone(decision) : undefined;
}
