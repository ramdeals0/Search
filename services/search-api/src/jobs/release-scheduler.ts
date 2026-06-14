import { recordAuditLog } from "../audit-trail-store.js";
import { getLatestExecutedApprovalForSnapshot } from "../approval-store.js";
import { getSystemConfig } from "../bootstrap-store.js";
import {
  listDueScheduledReleases,
  markScheduledReleaseExecuted,
  markScheduledReleaseFailed,
} from "../scheduled-release-store.js";
import { replaceAllMerchandisingRules } from "../merchandising-rules.js";
import { replaceAllSynonyms } from "../synonyms.js";
import { promoteActiveConfiguration } from "../active-config-store.js";
import { linkEnvironmentSnapshot } from "../environment-config-store.js";
import { rollbackToSnapshot } from "../snapshot-store.js";

const PLATFORM_CONFIG_KEY = "bootstrap.platform";

export interface ReleaseExecutionHandlers {
  promoteSnapshot: (input: {
    snapshotId: string;
    reason: string;
    linkedExperimentId?: string;
    approvalRequestId?: string;
  }) => { restored: { id: string; name: string } } | null;
}

async function isApprovalRequired(): Promise<boolean> {
  const config = await getSystemConfig<Record<string, unknown>>(PLATFORM_CONFIG_KEY);
  return (config?.requireApprovalForLivePromotion as boolean | undefined) === true;
}

async function assertPromotionAllowed(
  snapshotId: string,
  approvalRequestId?: string,
): Promise<string | null> {
  if (!(await isApprovalRequired())) {
    return null;
  }

  if (approvalRequestId) {
    const executed = getLatestExecutedApprovalForSnapshot(snapshotId);
    if (executed?.id === approvalRequestId) {
      return null;
    }
  }

  const executed = getLatestExecutedApprovalForSnapshot(snapshotId);
  if (!executed) {
    return "Live promotion requires an executed approval request.";
  }

  return null;
}

export async function executeScheduledRelease(
  release: {
    id: string;
    type: "promote_snapshot" | "rollback_snapshot";
    snapshotId: string;
    reason: string;
    linkedExperimentId?: string;
    approvalRequestId?: string;
  },
  handlers: ReleaseExecutionHandlers,
): Promise<void> {
  if (release.type === "promote_snapshot") {
    const policyError = await assertPromotionAllowed(
      release.snapshotId,
      release.approvalRequestId,
    );
    if (policyError) {
      await markScheduledReleaseFailed(release.id, policyError);
      return;
    }

    const result = handlers.promoteSnapshot({
      snapshotId: release.snapshotId,
      reason: release.reason,
      linkedExperimentId: release.linkedExperimentId,
      approvalRequestId: release.approvalRequestId,
    });

    if (!result) {
      await markScheduledReleaseFailed(release.id, "Snapshot not found.");
      return;
    }

    recordAuditLog({
      actionType: "promote_snapshot",
      entityType: "config_snapshot",
      entityId: result.restored.id,
      entityLabel: result.restored.name,
      outcome: "success",
      summary: `Scheduled promotion executed for snapshot '${result.restored.name}'`,
      metadata: { scheduledReleaseId: release.id },
    });
    await markScheduledReleaseExecuted(release.id);
    return;
  }

  const restored = rollbackToSnapshot(
    release.snapshotId,
    (rules) => replaceAllMerchandisingRules(rules, "live"),
    (synonyms) => replaceAllSynonyms(synonyms, "live"),
  );

  if (!restored) {
    await markScheduledReleaseFailed(release.id, "Snapshot not found for rollback.");
    return;
  }

  promoteActiveConfiguration(restored, release.reason, release.linkedExperimentId);
  linkEnvironmentSnapshot("live", restored.id, restored.name);

  recordAuditLog({
    actionType: "rollback_snapshot",
    entityType: "config_snapshot",
    entityId: restored.id,
    entityLabel: restored.name,
    outcome: "success",
    summary: `Scheduled rollback executed for snapshot '${restored.name}'`,
    metadata: { scheduledReleaseId: release.id },
  });
  await markScheduledReleaseExecuted(release.id);
}

let schedulerTimer: NodeJS.Timeout | null = null;

export function startReleaseScheduler(
  handlers: ReleaseExecutionHandlers,
  intervalMs = 60_000,
): void {
  if (schedulerTimer) {
    return;
  }

  schedulerTimer = setInterval(() => {
    void processDueScheduledReleases(handlers);
  }, intervalMs);

  void processDueScheduledReleases(handlers);
}

export function stopReleaseScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

async function processDueScheduledReleases(
  handlers: ReleaseExecutionHandlers,
): Promise<void> {
  const due = await listDueScheduledReleases();
  for (const release of due) {
    try {
      await executeScheduledRelease(release, handlers);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Scheduled release failed.";
      await markScheduledReleaseFailed(release.id, message);
    }
  }
}
