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
import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
const prismaClient = prisma as any;

const querySets: EvaluationQuerySetDto[] = [];
const experiments: ExperimentDto[] = [];
const experimentRuns = new Map<string, ExperimentRunSummaryDto>();
const experimentScorecards = new Map<string, ExperimentScorecardDto>();
const experimentDecisions = new Map<string, ExperimentDecisionDto>();

let querySetIdCounter = 1;
let experimentIdCounter = 1;
let persistenceEnabled = false;

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

function toDate(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

function mapQuerySetRecord(row: {
  id: string;
  name: string;
  description: string | null;
  queries: unknown;
  createdAt: Date;
}): EvaluationQuerySetDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    queries: row.queries as EvaluationQuerySetDto["queries"],
    createdAt: row.createdAt.toISOString(),
  };
}

function mapExperimentRecord(row: {
  id: string;
  name: string;
  description: string | null;
  status: string;
  baselineSnapshotId: string;
  candidateSnapshotId: string;
  querySetId: string;
  candidateLlmOverrides: unknown;
  candidateAiConfig?: unknown;
  onlineEnabled: boolean;
  onlineTrafficPercent: number;
  createdAt: Date;
  lastRunAt: Date | null;
}): ExperimentDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status as ExperimentStatus,
    baselineSnapshotId: row.baselineSnapshotId,
    candidateSnapshotId: row.candidateSnapshotId,
    querySetId: row.querySetId,
    candidateLlmOverrides:
      (row.candidateLlmOverrides as ExperimentDto["candidateLlmOverrides"] | null) ??
      undefined,
    candidateAiConfig:
      (row.candidateAiConfig as ExperimentDto["candidateAiConfig"] | null) ?? undefined,
    onlineEnabled: row.onlineEnabled,
    onlineTrafficPercent: row.onlineTrafficPercent,
    createdAt: row.createdAt.toISOString(),
    lastRunAt: row.lastRunAt?.toISOString(),
  };
}

export async function hydrateExperimentStore(): Promise<void> {
  try {
    const [
      querySetRows,
      experimentRows,
      runRows,
      scorecardRows,
      decisionRows,
    ] = await Promise.all([
      prismaClient.evaluationQuerySet.findMany({
        orderBy: { createdAt: "desc" },
      }),
      prismaClient.experimentRecord.findMany({
        orderBy: { createdAt: "desc" },
      }),
      prismaClient.experimentRunRecord.findMany(),
      prismaClient.experimentScorecardRecord.findMany(),
      prismaClient.experimentDecisionRecord.findMany(),
    ]);

    querySets.length = 0;
    experiments.length = 0;
    experimentRuns.clear();
    experimentScorecards.clear();
    experimentDecisions.clear();

    for (const row of querySetRows) {
      querySets.push(mapQuerySetRecord(row));
    }
    for (const row of experimentRows) {
      experiments.push(mapExperimentRecord(row));
    }
    for (const row of runRows) {
      experimentRuns.set(row.experimentId, row.payload as ExperimentRunSummaryDto);
    }
    for (const row of scorecardRows) {
      experimentScorecards.set(
        row.experimentId,
        row.payload as ExperimentScorecardDto,
      );
    }
    for (const row of decisionRows) {
      experimentDecisions.set(
        row.experimentId,
        row.payload as ExperimentDecisionDto,
      );
    }

    persistenceEnabled = true;
  } catch {
    persistenceEnabled = false;
  }
}

export async function createQuerySet(
  input: CreateQuerySetRequestDto,
): Promise<EvaluationQuerySetDto> {
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

  if (persistenceEnabled) {
    try {
      await prismaClient.evaluationQuerySet.create({
        data: {
          id: querySet.id,
          name: querySet.name,
          description: querySet.description,
          queries: querySet.queries as unknown as Prisma.InputJsonValue,
          createdAt: new Date(querySet.createdAt),
        },
      });
    } catch {
      // Keep in-memory fallback behavior.
    }
  }

  return structuredClone(querySet);
}

export async function listQuerySets(): Promise<EvaluationQuerySetDto[]> {
  return [...querySets]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((querySet) => structuredClone(querySet));
}

export async function getQuerySetById(
  id: string,
): Promise<EvaluationQuerySetDto | undefined> {
  const querySet = querySets.find((item) => item.id === id);
  return querySet ? structuredClone(querySet) : undefined;
}

export async function createExperiment(
  input: CreateExperimentRequestDto,
): Promise<ExperimentDto> {
  const experiment: ExperimentDto = {
    id: createExperimentId(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    status: "draft",
    baselineSnapshotId: input.baselineSnapshotId,
    candidateSnapshotId: input.candidateSnapshotId,
    querySetId: input.querySetId,
    candidateLlmOverrides: input.candidateLlmOverrides,
    candidateAiConfig: input.candidateAiConfig,
    onlineEnabled: false,
    onlineTrafficPercent: 50,
    createdAt: new Date().toISOString(),
  };

  experiments.push(experiment);

  if (persistenceEnabled) {
    try {
      await prismaClient.experimentRecord.create({
        data: {
          id: experiment.id,
          name: experiment.name,
          description: experiment.description,
          status: experiment.status,
          baselineSnapshotId: experiment.baselineSnapshotId,
          candidateSnapshotId: experiment.candidateSnapshotId,
          querySetId: experiment.querySetId,
          candidateLlmOverrides:
            experiment.candidateLlmOverrides as unknown as Prisma.InputJsonValue,
          candidateAiConfig:
            experiment.candidateAiConfig as unknown as Prisma.InputJsonValue,
          onlineEnabled: experiment.onlineEnabled ?? false,
          onlineTrafficPercent: experiment.onlineTrafficPercent ?? 50,
          createdAt: new Date(experiment.createdAt),
        },
      });
    } catch {
      // Keep in-memory fallback behavior.
    }
  }

  return structuredClone(experiment);
}

export async function listExperiments(): Promise<ExperimentDto[]> {
  return [...experiments]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((experiment) => structuredClone(experiment));
}

export async function getExperimentById(
  id: string,
): Promise<ExperimentDto | undefined> {
  const experiment = experiments.find((item) => item.id === id);
  return experiment ? structuredClone(experiment) : undefined;
}

export async function updateExperimentStatus(
  id: string,
  status: ExperimentStatus,
): Promise<ExperimentDto | undefined> {
  const experiment = experiments.find((item) => item.id === id);
  if (!experiment) {
    return undefined;
  }

  experiment.status = status;

  if (persistenceEnabled) {
    try {
      await prismaClient.experimentRecord.update({
        where: { id },
        data: { status },
      });
    } catch {
      // Keep in-memory fallback behavior.
    }
  }

  return structuredClone(experiment);
}

export async function setExperimentOnlineStatus(
  id: string,
  onlineEnabled: boolean,
  onlineTrafficPercent?: number,
): Promise<ExperimentDto | undefined> {
  const experiment = experiments.find((item) => item.id === id);
  if (!experiment) {
    return undefined;
  }

  experiment.onlineEnabled = onlineEnabled;
  if (onlineTrafficPercent !== undefined) {
    experiment.onlineTrafficPercent = Math.max(
      0,
      Math.min(100, Math.round(onlineTrafficPercent)),
    );
  }

  if (persistenceEnabled) {
    try {
      await prismaClient.experimentRecord.update({
        where: { id },
        data: {
          onlineEnabled: experiment.onlineEnabled ?? false,
          onlineTrafficPercent: experiment.onlineTrafficPercent ?? 50,
        },
      });
    } catch {
      // Keep in-memory fallback behavior.
    }
  }

  return structuredClone(experiment);
}

export async function saveExperimentRun(
  run: ExperimentRunSummaryDto,
): Promise<void> {
  experimentRuns.set(run.experimentId, structuredClone(run));

  const experiment = experiments.find((item) => item.id === run.experimentId);
  if (experiment) {
    experiment.lastRunAt = run.runAt;
    experiment.status = "run";
  }

  if (persistenceEnabled) {
    try {
      await prismaClient.experimentRunRecord.upsert({
        where: { experimentId: run.experimentId },
        create: {
          experimentId: run.experimentId,
          payload: run as unknown as Prisma.InputJsonValue,
          runAt: new Date(run.runAt),
        },
        update: {
          payload: run as unknown as Prisma.InputJsonValue,
          runAt: new Date(run.runAt),
        },
      });
      await prismaClient.experimentRecord.update({
        where: { id: run.experimentId },
        data: {
          lastRunAt: toDate(run.runAt),
          status: "run",
        },
      });
    } catch {
      // Keep in-memory fallback behavior.
    }
  }
}

export async function getLastExperimentRun(
  experimentId: string,
): Promise<ExperimentRunSummaryDto | undefined> {
  const run = experimentRuns.get(experimentId);
  return run ? structuredClone(run) : undefined;
}

export async function saveExperimentScorecard(
  experimentId: string,
  scorecard: ExperimentScorecardDto,
): Promise<ExperimentScorecardDto> {
  experimentScorecards.set(experimentId, structuredClone(scorecard));

  if (persistenceEnabled) {
    try {
      await prismaClient.experimentScorecardRecord.upsert({
        where: { experimentId },
        create: {
          experimentId,
          payload: scorecard as unknown as Prisma.InputJsonValue,
          generatedAt: new Date(scorecard.generatedAt),
        },
        update: {
          payload: scorecard as unknown as Prisma.InputJsonValue,
          generatedAt: new Date(scorecard.generatedAt),
        },
      });
    } catch {
      // Keep in-memory fallback behavior.
    }
  }

  return structuredClone(scorecard);
}

export async function getExperimentScorecard(
  experimentId: string,
): Promise<ExperimentScorecardDto | undefined> {
  const scorecard = experimentScorecards.get(experimentId);
  return scorecard ? structuredClone(scorecard) : undefined;
}

export async function saveExperimentDecision(
  experimentId: string,
  input: SaveExperimentDecisionRequestDto,
  linkedRunAt?: string,
): Promise<ExperimentDecisionDto> {
  const decision: ExperimentDecisionDto = {
    experimentId,
    decidedAt: new Date().toISOString(),
    decision: input.decision,
    rationale: input.rationale.trim(),
    linkedRunAt,
  };

  experimentDecisions.set(experimentId, decision);

  if (persistenceEnabled) {
    try {
      await prismaClient.experimentDecisionRecord.upsert({
        where: { experimentId },
        create: {
          experimentId,
          payload: decision as unknown as Prisma.InputJsonValue,
          decidedAt: new Date(decision.decidedAt),
        },
        update: {
          payload: decision as unknown as Prisma.InputJsonValue,
          decidedAt: new Date(decision.decidedAt),
        },
      });
    } catch {
      // Keep in-memory fallback behavior.
    }
  }

  return structuredClone(decision);
}

export async function getExperimentDecision(
  experimentId: string,
): Promise<ExperimentDecisionDto | undefined> {
  const decision = experimentDecisions.get(experimentId);
  return decision ? structuredClone(decision) : undefined;
}
