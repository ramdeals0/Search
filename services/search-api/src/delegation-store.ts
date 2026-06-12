import type {
  CreateDelegationRuleRequestDto,
  DelegationListResponseDto,
  DelegationRuleDto,
} from "@retailer-search/shared-types";
import { getReviewerById } from "./reviewer-store.js";

const delegationRules: DelegationRuleDto[] = [];
let delegationIdCounter = 1;

function createDelegationId(): string {
  const id = `delegation-${Date.now()}-${delegationIdCounter}`;
  delegationIdCounter += 1;
  return id;
}

function cloneRule(rule: DelegationRuleDto): DelegationRuleDto {
  return structuredClone(rule);
}

export function isDelegationActive(
  rule: DelegationRuleDto,
  now: Date = new Date(),
): boolean {
  if (!rule.active) {
    return false;
  }

  const nowMs = now.getTime();

  if (rule.startAt) {
    const startMs = new Date(rule.startAt).getTime();
    if (nowMs < startMs) {
      return false;
    }
  }

  if (rule.endAt) {
    const endMs = new Date(rule.endAt).getTime();
    if (nowMs > endMs) {
      return false;
    }
  }

  return true;
}

export function createDelegationRule(
  input: CreateDelegationRuleRequestDto,
): DelegationRuleDto | null {
  const fromReviewer = getReviewerById(input.fromReviewerId);
  const toReviewer = getReviewerById(input.toReviewerId);

  if (!fromReviewer?.active || !toReviewer?.active) {
    return null;
  }

  if (input.fromReviewerId === input.toReviewerId) {
    return null;
  }

  const rule: DelegationRuleDto = {
    id: createDelegationId(),
    fromReviewerId: input.fromReviewerId,
    toReviewerId: input.toReviewerId,
    mode: input.mode,
    startAt: input.startAt,
    endAt: input.endAt,
    active: true,
    reason: input.reason?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  delegationRules.unshift(rule);
  return cloneRule(rule);
}

export function listDelegationRules(): DelegationListResponseDto {
  return {
    total: delegationRules.length,
    rules: delegationRules.map(cloneRule),
  };
}

export function getDelegationRuleById(id: string): DelegationRuleDto | undefined {
  const rule = delegationRules.find((entry) => entry.id === id);
  return rule ? cloneRule(rule) : undefined;
}

export function getActiveDelegationForReviewer(
  reviewerId: string,
  now: Date = new Date(),
): DelegationRuleDto | undefined {
  const rule = delegationRules.find(
    (entry) => entry.fromReviewerId === reviewerId && isDelegationActive(entry, now),
  );
  return rule ? cloneRule(rule) : undefined;
}

export function listActiveDelegationsForReviewers(
  reviewerIds: string[],
  now: Date = new Date(),
): DelegationRuleDto[] {
  return reviewerIds
    .map((reviewerId) => getActiveDelegationForReviewer(reviewerId, now))
    .filter((rule): rule is DelegationRuleDto => rule !== undefined);
}

export function deactivateDelegationRule(id: string): DelegationRuleDto | null {
  const rule = delegationRules.find((entry) => entry.id === id);
  if (!rule) {
    return null;
  }

  rule.active = false;
  return cloneRule(rule);
}
