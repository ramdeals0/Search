import type { ExperimentArmAiConfigDto } from "@retailer-search/shared-types";
import { getExperimentById } from "../experiment-store.js";
import { getOnlineExperimentAssignment } from "../online-experiment-service.js";

export async function resolveExperimentAiConfigForSearch(sessionId: string): Promise<{
  arm: "baseline" | "candidate" | null;
  aiConfig?: ExperimentArmAiConfigDto | null;
}> {
  const assignment = await getOnlineExperimentAssignment(sessionId);
  if (!assignment?.onlineEnabled || !assignment.assignedArm) {
    return { arm: null };
  }

  if (assignment.assignedArm === "baseline") {
    return { arm: "baseline", aiConfig: null };
  }

  const experiment = await getExperimentById(assignment.experimentId);
  return {
    arm: "candidate",
    aiConfig: (experiment?.candidateAiConfig as ExperimentArmAiConfigDto | undefined) ?? null,
  };
}
