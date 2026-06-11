import type {
  ApprovalDecisionEntryDto,
  ApprovalEligibilityResponseDto,
  ApprovalListResponseDto,
  ApprovalRequestDto,
  ApprovalSlaOverviewDto,
  ApprovalSlaPolicyDto,
  ApprovalSlaStatusDto,
  CreateApprovalRequestDto,
  NotificationDto,
  NotificationType,
  ReviewerRole,
  UpdateApprovalSlaPolicyRequestDto,
} from "@retailer-search/shared-types";
import {
  createNotification,
  notificationExists,
} from "./notification-store.js";
import {
  getApprovalPolicy,
  getReviewerById,
  listReviewers,
  resolveRequesterActor,
  resolveReviewerActor,
} from "./reviewer-store.js";
import { getConfigSnapshotById } from "./snapshot-store.js";

const approvalRequests: ApprovalRequestDto[] = [];
let approvalIdCounter = 1;

let approvalSlaPolicy: ApprovalSlaPolicyDto = {
  enabled: true,
  reminderAfterHours: 24,
  overdueAfterHours: 48,
  escalationAfterHours: 72,
};

const MS_PER_HOUR = 60 * 60 * 1000;

function createApprovalId(): string {
  const id = `approval-${Date.now()}-${approvalIdCounter}`;
  approvalIdCounter += 1;
  return id;
}

function touchRequest(request: ApprovalRequestDto): void {
  request.updatedAt = new Date().toISOString();
}

function cloneRequest(request: ApprovalRequestDto): ApprovalRequestDto {
  return structuredClone(request);
}

function findRequest(id: string): ApprovalRequestDto | undefined {
  return approvalRequests.find((request) => request.id === id);
}

function getApprovedDecisions(
  request: ApprovalRequestDto,
): ApprovalDecisionEntryDto[] {
  return (request.decisions ?? []).filter(
    (decision) => decision.decision === "approved",
  );
}

function getDistinctApproverIds(request: ApprovalRequestDto): string[] {
  return [...new Set(getApprovedDecisions(request).map((entry) => entry.actorId))];
}

function syncApprovalCompletion(request: ApprovalRequestDto): void {
  if (
    request.status === "rejected" ||
    request.status === "cancelled" ||
    request.status === "executed"
  ) {
    return;
  }

  const requiredCount = request.requiredApprovalCount ?? 1;
  const distinctApprovers = getDistinctApproverIds(request);

  if (distinctApprovers.length >= requiredCount) {
    request.status = "approved";
    const lastApproval = getApprovedDecisions(request).at(-1);
    if (lastApproval) {
      request.approvedBy = {
        actorId: lastApproval.actorId,
        actorLabel: lastApproval.actorLabel,
      };
    }
    return;
  }

  request.status = "pending";
  request.approvedBy = undefined;
}

export function createApprovalRequest(
  input: CreateApprovalRequestDto & { actorId?: string },
): ApprovalRequestDto | null {
  const snapshot = getConfigSnapshotById(input.snapshotId);
  if (!snapshot) {
    return null;
  }

  const requester = resolveRequesterActor(input.actorId);
  if (!requester) {
    return null;
  }

  const policy = getApprovalPolicy();
  const now = new Date().toISOString();
  const request: ApprovalRequestDto = {
    id: createApprovalId(),
    createdAt: now,
    updatedAt: now,
    status: "pending",
    sourceEnvironment: "staging",
    targetEnvironment: "live",
    snapshotId: snapshot.id,
    snapshotName: snapshot.name,
    requestedBy: {
      actorId: requester.actorId,
      actorLabel: requester.actorLabel,
    },
    reason: input.reason.trim(),
    linkedExperimentId: input.linkedExperimentId,
    assignedReviewerIds: input.assignedReviewerIds,
    decisions: [],
    requiredApprovalCount: policy.requireSecondApprover ? 2 : 1,
  };

  approvalRequests.unshift(request);
  return cloneRequest(request);
}

export function getApprovalSlaPolicy(): ApprovalSlaPolicyDto {
  return structuredClone(approvalSlaPolicy);
}

export function updateApprovalSlaPolicy(
  input: UpdateApprovalSlaPolicyRequestDto,
): ApprovalSlaPolicyDto {
  approvalSlaPolicy = {
    enabled: input.enabled,
    reminderAfterHours: input.reminderAfterHours,
    overdueAfterHours: input.overdueAfterHours,
    escalationAfterHours: input.escalationAfterHours,
  };

  return getApprovalSlaPolicy();
}

function getRecipientActorIds(request: ApprovalRequestDto): string[] {
  if (request.assignedReviewerIds && request.assignedReviewerIds.length > 0) {
    return request.assignedReviewerIds;
  }

  const approverRoles: ReviewerRole[] = [
    "reviewer",
    "approver",
    "release_manager",
  ];
  return listReviewers()
    .reviewers.filter(
      (reviewer) => reviewer.active && approverRoles.includes(reviewer.role),
    )
    .map((reviewer) => reviewer.id);
}

function computeAgeHours(createdAt: string, now: Date): number {
  const ageMs = now.getTime() - new Date(createdAt).getTime();
  return Number((ageMs / MS_PER_HOUR).toFixed(2));
}

function addHoursIso(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * MS_PER_HOUR).toISOString();
}

export function computeApprovalSlaStatus(
  request: ApprovalRequestDto,
  now: Date = new Date(),
): ApprovalSlaStatusDto {
  const ageHours = computeAgeHours(request.createdAt, now);
  const targetReminderAt = addHoursIso(
    request.createdAt,
    approvalSlaPolicy.reminderAfterHours,
  );
  const targetOverdueAt = addHoursIso(
    request.createdAt,
    approvalSlaPolicy.overdueAfterHours,
  );

  if (request.status !== "pending") {
    return {
      approvalRequestId: request.id,
      status: "completed",
      ageHours,
      reminderDue: false,
      overdue: false,
      targetReminderAt,
      targetOverdueAt,
    };
  }

  if (!approvalSlaPolicy.enabled) {
    return {
      approvalRequestId: request.id,
      status: "on_track",
      ageHours,
      reminderDue: false,
      overdue: false,
      targetReminderAt,
      targetOverdueAt,
    };
  }

  const reminderDue = ageHours >= approvalSlaPolicy.reminderAfterHours;
  const overdue = ageHours >= approvalSlaPolicy.overdueAfterHours;

  let status: ApprovalSlaStatusDto["status"] = "on_track";
  if (overdue) {
    status = "overdue";
  } else if (reminderDue) {
    status = "due_soon";
  }

  return {
    approvalRequestId: request.id,
    status,
    ageHours,
    reminderDue,
    overdue,
    targetReminderAt,
    targetOverdueAt,
  };
}

export function computeApprovalSlaOverview(
  now: Date = new Date(),
): ApprovalSlaOverviewDto {
  const items = approvalRequests.map((request) =>
    computeApprovalSlaStatus(request, now),
  );

  const summary = {
    pendingCount: items.filter((item) => item.status === "on_track").length,
    dueSoonCount: items.filter((item) => item.status === "due_soon").length,
    overdueCount: items.filter((item) => item.status === "overdue").length,
    completedCount: items.filter((item) => item.status === "completed").length,
  };

  return {
    generatedAt: now.toISOString(),
    summary,
    items,
  };
}

function createApprovalNotificationIfMissing(
  request: ApprovalRequestDto,
  type: NotificationType,
  title: string,
  message: string,
  recipientActorId?: string,
): NotificationDto | null {
  if (
    request.id &&
    notificationExists(request.id, type, recipientActorId)
  ) {
    return null;
  }

  return createNotification({
    type,
    title,
    message,
    relatedApprovalRequestId: request.id,
    recipientActorId,
  });
}

export function notifyApprovalRequested(
  request: ApprovalRequestDto,
): NotificationDto[] {
  const recipients = getRecipientActorIds(request);
  const created: NotificationDto[] = [];

  for (const recipientActorId of recipients) {
    const notification = createApprovalNotificationIfMissing(
      request,
      "approval_requested",
      "Approval requested",
      `Release approval requested for snapshot '${request.snapshotName ?? request.snapshotId}'.`,
      recipientActorId,
    );
    if (notification) {
      created.push(notification);
    }
  }

  if (created.length === 0 && recipients.length === 0) {
    const notification = createApprovalNotificationIfMissing(
      request,
      "approval_requested",
      "Approval requested",
      `Release approval requested for snapshot '${request.snapshotName ?? request.snapshotId}'.`,
    );
    if (notification) {
      created.push(notification);
    }
  }

  return created;
}

export function notifyApprovalApproved(
  request: ApprovalRequestDto,
): NotificationDto | null {
  return createApprovalNotificationIfMissing(
    request,
    "approval_approved",
    "Approval completed",
    `Release request for '${request.snapshotName ?? request.snapshotId}' is fully approved and ready to execute.`,
    request.requestedBy.actorId,
  );
}

export function notifyApprovalRejected(
  request: ApprovalRequestDto,
): NotificationDto | null {
  return createApprovalNotificationIfMissing(
    request,
    "approval_rejected",
    "Approval rejected",
    `Release request for '${request.snapshotName ?? request.snapshotId}' was rejected.`,
    request.requestedBy.actorId,
  );
}

export function notifyApprovalExecuted(
  request: ApprovalRequestDto,
): NotificationDto | null {
  return createApprovalNotificationIfMissing(
    request,
    "approval_executed",
    "Release executed",
    `Approved release for '${request.snapshotName ?? request.snapshotId}' was executed to live.`,
    request.requestedBy.actorId,
  );
}

export function maybeGenerateApprovalNotifications(
  now: Date = new Date(),
): NotificationDto[] {
  if (!approvalSlaPolicy.enabled) {
    return [];
  }

  const created: NotificationDto[] = [];

  for (const request of approvalRequests) {
    if (request.status !== "pending") {
      continue;
    }

    const sla = computeApprovalSlaStatus(request, now);
    const recipients = getRecipientActorIds(request);
    const targetRecipients = recipients.length > 0 ? recipients : [undefined];

    if (sla.reminderDue) {
      for (const recipientActorId of targetRecipients) {
        const notification = createApprovalNotificationIfMissing(
          request,
          "approval_reminder",
          "Approval reminder",
          `Release request for '${request.snapshotName ?? request.snapshotId}' is awaiting review (${sla.ageHours}h old).`,
          recipientActorId,
        );
        if (notification) {
          created.push(notification);
        }
      }
    }

    if (sla.overdue) {
      for (const recipientActorId of targetRecipients) {
        const notification = createApprovalNotificationIfMissing(
          request,
          "approval_overdue",
          "Approval overdue",
          `Release request for '${request.snapshotName ?? request.snapshotId}' is overdue (${sla.ageHours}h old).`,
          recipientActorId,
        );
        if (notification) {
          created.push(notification);
        }
      }
    }
  }

  return created;
}

export function listApprovalRequests(): ApprovalListResponseDto {
  return {
    total: approvalRequests.length,
    requests: approvalRequests.map(cloneRequest),
  };
}

export function getApprovalRequestById(
  id: string,
): ApprovalRequestDto | undefined {
  const request = findRequest(id);
  return request ? cloneRequest(request) : undefined;
}

export function getPendingApprovalForSnapshot(
  snapshotId: string,
): ApprovalRequestDto | undefined {
  const request = approvalRequests.find(
    (entry) => entry.status === "pending" && entry.snapshotId === snapshotId,
  );
  return request ? cloneRequest(request) : undefined;
}

export function getLatestExecutedApprovalForSnapshot(
  snapshotId: string,
): ApprovalRequestDto | undefined {
  const request = approvalRequests.find(
    (entry) => entry.status === "executed" && entry.snapshotId === snapshotId,
  );
  return request ? cloneRequest(request) : undefined;
}

export function assignReviewersToApprovalRequest(
  id: string,
  reviewerIds: string[],
): ApprovalRequestDto | null {
  const request = findRequest(id);
  if (!request || request.status !== "pending") {
    return null;
  }

  const validReviewerIds = reviewerIds.filter((reviewerId) => {
    const reviewer = getReviewerById(reviewerId);
    return reviewer?.active === true;
  });

  request.assignedReviewerIds = validReviewerIds;
  touchRequest(request);
  return cloneRequest(request);
}

export function getApprovalEligibility(
  id: string,
  actorId: string,
  actorRole?: ReviewerRole,
): ApprovalEligibilityResponseDto {
  const request = findRequest(id);
  const reasons: string[] = [];

  if (!request) {
    return {
      canApprove: false,
      canExecute: false,
      reasons: ["Approval request not found."],
    };
  }

  const actor = resolveReviewerActor(actorId, actorRole);
  if (!actor) {
    return {
      canApprove: false,
      canExecute: false,
      reasons: ["Reviewer not found or inactive."],
    };
  }

  const policy = getApprovalPolicy();
  let canApprove = request.status === "pending";
  let canExecute = request.status === "approved";

  if (request.status !== "pending") {
    reasons.push("Approval is only allowed while the request is pending.");
    canApprove = false;
  }

  if (request.status !== "approved") {
    reasons.push("Execution is only allowed after the request is fully approved.");
    canExecute = false;
  }

  if (canApprove) {
    if (!policy.allowedApproverRoles.includes(actor.role)) {
      canApprove = false;
      reasons.push(`Role '${actor.role}' is not allowed to approve releases.`);
    }

    if (
      policy.requireDifferentActorForApproval &&
      actor.actorId === request.requestedBy.actorId
    ) {
      canApprove = false;
      reasons.push("Requester cannot approve their own release request.");
    }

    if (getDistinctApproverIds(request).includes(actor.actorId)) {
      canApprove = false;
      reasons.push("This reviewer has already recorded an approval decision.");
    }

    if (
      request.assignedReviewerIds &&
      request.assignedReviewerIds.length > 0 &&
      !request.assignedReviewerIds.includes(actor.actorId)
    ) {
      canApprove = false;
      reasons.push("Only assigned reviewers can approve this request.");
    }
  }

  if (canExecute) {
    if (!policy.allowedExecutorRoles.includes(actor.role)) {
      canExecute = false;
      reasons.push(`Role '${actor.role}' is not allowed to execute releases.`);
    }

    if (policy.requireDifferentActorForExecution) {
      const approverIds = getDistinctApproverIds(request);
      if (approverIds.includes(actor.actorId)) {
        canExecute = false;
        reasons.push("An approver cannot also execute this release request.");
      }
    }
  }

  if (canApprove) {
    reasons.push("Reviewer is eligible to record an approval decision.");
  }

  if (canExecute) {
    reasons.push("Reviewer is eligible to execute this approved release.");
  }

  return {
    canApprove,
    canExecute,
    reasons,
  };
}

export function addApprovalDecision(
  id: string,
  actor: { actorId: string; actorLabel: string; role: ReviewerRole },
  decision: "approved" | "rejected",
  note?: string,
): { request: ApprovalRequestDto | null; error?: string } {
  const eligibility = getApprovalEligibility(id, actor.actorId, actor.role);
  if (decision === "approved" && !eligibility.canApprove) {
    return {
      request: null,
      error: eligibility.reasons[0] ?? "Reviewer is not eligible to approve.",
    };
  }

  const request = findRequest(id);
  if (!request || request.status !== "pending") {
    return {
      request: null,
      error: "Only pending approval requests can receive approval decisions.",
    };
  }

  if (decision === "rejected") {
    const entry: ApprovalDecisionEntryDto = {
      actorId: actor.actorId,
      actorLabel: actor.actorLabel,
      decision: "rejected",
      note: note?.trim() || undefined,
      decidedAt: new Date().toISOString(),
    };

    request.decisions = [...(request.decisions ?? []), entry];
    request.status = "rejected";
    request.rejectedBy = {
      actorId: actor.actorId,
      actorLabel: actor.actorLabel,
    };
    request.decisionNote = note?.trim() || undefined;
    touchRequest(request);
    return { request: cloneRequest(request) };
  }

  const entry: ApprovalDecisionEntryDto = {
    actorId: actor.actorId,
    actorLabel: actor.actorLabel,
    decision: "approved",
    note: note?.trim() || undefined,
    decidedAt: new Date().toISOString(),
  };

  request.decisions = [...(request.decisions ?? []), entry];
  syncApprovalCompletion(request);
  touchRequest(request);
  return { request: cloneRequest(request) };
}

export function approveApprovalRequest(
  id: string,
  actorId?: string,
  actorRole?: ReviewerRole,
  note?: string,
): { request: ApprovalRequestDto | null; error?: string } {
  const actor = resolveReviewerActor(actorId, actorRole);
  if (!actor) {
    return { request: null, error: "Reviewer not found or inactive." };
  }

  return addApprovalDecision(id, actor, "approved", note);
}

export function rejectApprovalRequest(
  id: string,
  actorId?: string,
  actorRole?: ReviewerRole,
  note?: string,
): { request: ApprovalRequestDto | null; error?: string } {
  const request = findRequest(id);
  if (!request || request.status !== "pending") {
    return {
      request: null,
      error: "Only pending approval requests can be rejected.",
    };
  }

  const actor = resolveReviewerActor(actorId, actorRole);
  if (!actor) {
    return { request: null, error: "Reviewer not found or inactive." };
  }

  return addApprovalDecision(id, actor, "rejected", note);
}

export function cancelApprovalRequest(
  id: string,
  note?: string,
): ApprovalRequestDto | null {
  const request = findRequest(id);
  if (!request || request.status !== "pending") {
    return null;
  }

  request.status = "cancelled";
  request.decisionNote = note?.trim() || undefined;
  touchRequest(request);
  return cloneRequest(request);
}

export function markApprovalRequestExecuted(
  id: string,
  actorId?: string,
  actorRole?: ReviewerRole,
): { request: ApprovalRequestDto | null; error?: string } {
  const actor = resolveReviewerActor(actorId, actorRole);
  if (!actor) {
    return { request: null, error: "Reviewer not found or inactive." };
  }

  const eligibility = getApprovalEligibility(id, actor.actorId, actor.role);
  if (!eligibility.canExecute) {
    return {
      request: null,
      error: eligibility.reasons[0] ?? "Reviewer is not eligible to execute.",
    };
  }

  const request = findRequest(id);
  if (!request || request.status !== "approved") {
    return {
      request: null,
      error: "Only fully approved requests can be executed.",
    };
  }

  request.status = "executed";
  request.executedBy = {
    actorId: actor.actorId,
    actorLabel: actor.actorLabel,
  };
  touchRequest(request);
  return { request: cloneRequest(request) };
}
