import type {
  ActiveConfigurationDto,
  MerchandisingConfigSnapshotDto,
  PromotionHistoryEntryDto,
  PromotionHistoryResponseDto,
} from "@retailer-search/shared-types";
import { DEFAULT_AUDIT_ACTOR } from "./audit-log-store.js";

let activeConfiguration: ActiveConfigurationDto | null = null;
const promotionHistory: PromotionHistoryEntryDto[] = [];
let promotionIdCounter = 1;

function createPromotionId(): string {
  const id = `promo-${Date.now()}-${promotionIdCounter}`;
  promotionIdCounter += 1;
  return id;
}

export function getActiveConfiguration(): ActiveConfigurationDto | null {
  return activeConfiguration ? structuredClone(activeConfiguration) : null;
}

export function promoteActiveConfiguration(
  snapshot: MerchandisingConfigSnapshotDto,
  reason: string,
  sourceExperimentId?: string,
  actor: { actorId: string; actorLabel: string } = DEFAULT_AUDIT_ACTOR,
): ActiveConfigurationDto {
  const promotedAt = new Date().toISOString();
  const trimmedReason = reason.trim();

  const historyEntry: PromotionHistoryEntryDto = {
    id: createPromotionId(),
    snapshotId: snapshot.id,
    snapshotName: snapshot.name,
    promotedAt,
    promotedBy: {
      actorId: actor.actorId,
      actorLabel: actor.actorLabel,
    },
    reason: trimmedReason,
    sourceExperimentId,
  };

  promotionHistory.unshift(historyEntry);

  activeConfiguration = {
    snapshotId: snapshot.id,
    snapshotName: snapshot.name,
    promotedAt,
    promotedBy: historyEntry.promotedBy,
    counts: structuredClone(snapshot.counts),
  };

  return structuredClone(activeConfiguration);
}

export function listPromotionHistory(): PromotionHistoryResponseDto {
  return {
    total: promotionHistory.length,
    entries: structuredClone(promotionHistory),
  };
}
