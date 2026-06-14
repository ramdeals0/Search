import type { MerchandisingRule, OnlineExperimentStatusDto } from "@retailer-search/shared-types";
import { getSnapshotSearchConfig } from "./snapshot-store.js";
import { getExperimentById, listExperiments } from "./experiment-store.js";

function stableBucket(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

async function getActiveOnlineExperiment() {
  const experiments = await listExperiments();
  return experiments
    .filter((experiment) => experiment.onlineEnabled)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
}

export async function getOnlineExperimentAssignment(
  sessionId: string,
): Promise<OnlineExperimentStatusDto | null> {
  const normalizedSessionId = sessionId.trim();
  const activeExperiment = await getActiveOnlineExperiment();
  if (!activeExperiment) {
    return null;
  }

  const trafficPercent = activeExperiment.onlineTrafficPercent ?? 50;
  const arm: "baseline" | "candidate" =
    normalizedSessionId &&
    stableBucket(`${activeExperiment.id}:${normalizedSessionId}`) < trafficPercent
      ? "candidate"
      : "baseline";

  return {
    experimentId: activeExperiment.id,
    name: activeExperiment.name,
    onlineEnabled: activeExperiment.onlineEnabled ?? false,
    assignedArm: arm,
    trafficPercent,
  };
}

export async function resolveExperimentRulesForSearch(
  sessionId: string,
): Promise<{
  arm: "baseline" | "candidate" | null;
  rules?: MerchandisingRule[];
}> {
  const assignment = await getOnlineExperimentAssignment(sessionId);
  if (!assignment || !assignment.onlineEnabled || assignment.assignedArm === null) {
    return { arm: null };
  }

  if (assignment.assignedArm === "baseline") {
    return { arm: "baseline" };
  }

  const experiment = await getExperimentById(assignment.experimentId);
  if (!experiment) {
    return { arm: null };
  }

  const candidate = getSnapshotSearchConfig(experiment.candidateSnapshotId);
  if (!candidate) {
    return { arm: "candidate" };
  }

  return {
    arm: "candidate",
    rules: candidate.rules.filter((rule) => rule.active),
  };
}
