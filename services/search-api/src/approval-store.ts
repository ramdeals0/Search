import type {
  ApprovalAssignmentChangeDto,
  ApprovalAssignmentHistoryResponseDto,
  ApprovalDecisionEntryDto,
  ApprovalEligibilityResponseDto,
  ApprovalExceptionDto,
  ApprovalExceptionListResponseDto,
  ApprovalListResponseDto,
  ApprovalRequestDto,
  ApprovalSlaOverviewDto,
  ApprovalSlaPolicyDto,
  ApprovalSlaStatusDto,
  CreateApprovalRequestDto,
  ExceptionType,
  NotificationDto,
  NotificationType,
  ReviewerRole,
  UpdateApprovalSlaPolicyRequestDto,
} from "@retailer-search/shared-types";
import {
  listActiveDelegationsForReviewers,
} from "./delegation-store.js";
import {
  createNotification,
  notificationExists,
  notifyApprovalExceptionOpened,
  notifyApprovalReassigned,
} from "./notification-store.js";
import {
  getApprovalPolicy,
  getReviewerById,
  listReviewers,
  resolveRequesterActor,
  resolveReviewerActor,
} from "./reviewer-store.js";
import { getConfigSnapshotById } from "./snapshot-store.js";
import { recordAuditLog } from "./audit-trail-store.js";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

const approvalRequests: ApprovalRequestDto[] = [];
const assignmentHistoryByRequest = new Map<string, ApprovalAssignmentChangeDto[]>();
const approvalExceptions: ApprovalExceptionDto[] = [];
let approvalIdCounter = 1;
let exceptionIdCounter = 1;

let approvalSlaPolicy: ApprovalSlaPolicyDto = {
  enabled: true,
  reminderAfterHours: 24,
  overdueAfterHours: 48,
  escalationAfterHours: 72,
};

/** In-memory only: assignment history is not persisted in SQLite MVP. */
/** In-memory only: approval exceptions are not persisted in SQLite MVP. */

const MS_PER_HOUR = 60 * 60 * 1000;

function mapApprovalRowToDto(row: {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  sourceEnvironment: string;
  targetEnvironment: string;
  snapshotId: string | null;
  snapshotName: string | null;
  requestedBy: unknown;
  approvedBy: unknown;
  rejectedBy: unknown;
  reason: string;
  decisionNote: string | null;
  linkedExperimentId: string | null;
  assignedReviewerIds: unknown;
  decisions: unknown;
  requiredApprovalCount: number | null;
  executedBy: unknown;
}): ApprovalRequestDto {
  return {
    id: row.id,
    status: row.status as ApprovalRequestDto["status"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    sourceEnvironment: row.sourceEnvironment as ApprovalRequestDto["sourceEnvironment"],
    targetEnvironment: row.targetEnvironment as ApprovalRequestDto["targetEnvironment"],
    snapshotId: row.snapshotId ?? undefined,
    snapshotName: row.snapshotName ?? undefined,
    requestedBy: row.requestedBy as ApprovalRequestDto["requestedBy"],
    approvedBy: (row.approvedBy as ApprovalRequestDto["approvedBy"]) ?? undefined,
    rejectedBy: (row.rejectedBy as ApprovalRequestDto["rejectedBy"]) ?? undefined,
    reason: row.reason,
    decisionNote: row.decisionNote ?? undefined,
    linkedExperimentId: row.linkedExperimentId ?? undefined,
    assignedReviewerIds: (row.assignedReviewerIds as string[] | null) ?? undefined,
    decisions: (row.decisions as ApprovalRequestDto["decisions"]) ?? undefined,
    requiredApprovalCount: row.requiredApprovalCount ?? undefined,
    executedBy: (row.executedBy as ApprovalRequestDto["executedBy"]) ?? undefined,
  };
}

function persistApprovalRequest(request: ApprovalRequestDto): void {
  void prisma.approvalRequest
    .upsert({
      where: { id: request.id },
      create: {
        id: request.id,
        status: request.status,
        createdAt: new Date(request.createdAt),
        updatedAt: new Date(request.updatedAt),
        sourceEnvironment: request.sourceEnvironment,
        targetEnvironment: request.targetEnvironment,
        snapshotId: request.snapshotId,
        snapshotName: request.snapshotName,
        requestedBy: request.requestedBy as Prisma.InputJsonValue,
        approvedBy: (request.approvedBy ?? undefined) as Prisma.InputJsonValue | undefined,
        rejectedBy: (request.rejectedBy ?? undefined) as Prisma.InputJsonValue | undefined,
        reason: request.reason,
        decisionNote: request.decisionNote,
        linkedExperimentId: request.linkedExperimentId,
        assignedReviewerIds: (request.assignedReviewerIds ??
          undefined) as Prisma.InputJsonValue | undefined,
        decisions: (request.decisions ?? undefined) as Prisma.InputJsonValue | undefined,
        requiredApprovalCount: request.requiredApprovalCount,
        executedBy: (request.executedBy ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      update: {
        status: request.status,
        updatedAt: new Date(request.updatedAt),
        snapshotName: request.snapshotName,
        approvedBy: (request.approvedBy ?? undefined) as Prisma.InputJsonValue | undefined,
        rejectedBy: (request.rejectedBy ?? undefined) as Prisma.InputJsonValue | undefined,
        decisionNote: request.decisionNote,
        assignedReviewerIds: (request.assignedReviewerIds ??
          undefined) as Prisma.InputJsonValue | undefined,
        decisions: (request.decisions ?? undefined) as Prisma.InputJsonValue | undefined,
        requiredApprovalCount: request.requiredApprovalCount,
        executedBy: (request.executedBy ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
    .catch((error: unknown) => {
      console.error("Failed to persist approval request", request.id, error);
    });
}

export async function hydrateApprovalStore(): Promise<void> {
  approvalRequests.length = 0;
  const rows = await prisma.approvalRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
  for (const row of rows) {
    approvalRequests.push(mapApprovalRowToDto(row));
  }
}

function createApprovalId(): string {
  const id = `approval-${Date.now()}-${approvalIdCounter}`;
  approvalIdCounter += 1;
  return id;
}

function touchRequest(request: ApprovalRequestDto): void {
  request.updatedAt = new Date().toISOString();
  persistApprovalRequest(request);
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

function getDefaultReviewerPool(): string[] {
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

function getStoredAssignedReviewerIds(request: ApprovalRequestDto): string[] {
  if (request.assignedReviewerIds && request.assignedReviewerIds.length > 0) {
    return [...request.assignedReviewerIds];
  }

  return getDefaultReviewerPool();
}

function sortReviewerIds(reviewerIds: string[]): string[] {
  return [...new Set(reviewerIds)].sort();
}

function syncDelegationReassignments(
  request: ApprovalRequestDto,
  now: Date = new Date(),
): void {
  if (request.status !== "pending") {
    return;
  }

  const assigned = request.assignedReviewerIds;
  if (!assigned || assigned.length === 0) {
    return;
  }

  const reassignRules = listActiveDelegationsForReviewers(assigned, now).filter(
    (rule) => rule.mode === "reassign",
  );

  if (reassignRules.length === 0) {
    return;
  }

  let nextReviewerIds = [...assigned];
  const reasons: string[] = [];

  for (const rule of reassignRules) {
    if (!nextReviewerIds.includes(rule.fromReviewerId)) {
      continue;
    }

    nextReviewerIds = sortReviewerIds(
      nextReviewerIds.map((reviewerId) =>
        reviewerId === rule.fromReviewerId ? rule.toReviewerId : reviewerId,
      ),
    );
    reasons.push(
      `Active reassignment delegation from ${rule.fromReviewerId} to ${rule.toReviewerId}`,
    );
  }

  if (
    reasons.length > 0 &&
    JSON.stringify(nextReviewerIds) !== JSON.stringify(sortReviewerIds(assigned))
  ) {
    recordApprovalAssignmentChange({
      approvalRequestId: request.id,
      previousReviewerIds: assigned,
      nextReviewerIds,
      reason: reasons.join("; "),
      changeType: "reassigned",
    });
    request.assignedReviewerIds = nextReviewerIds;
    touchRequest(request);
  }
}

export function getEffectiveReviewerIds(
  approvalRequestId: string,
  now: Date = new Date(),
): {
  assignedReviewerIds: string[];
  effectiveReviewerIds: string[];
  delegatedReviewerIds: string[];
} {
  const request = findRequest(approvalRequestId);
  if (!request) {
    return {
      assignedReviewerIds: [],
      effectiveReviewerIds: [],
      delegatedReviewerIds: [],
    };
  }

  syncDelegationReassignments(request, now);

  const assignedReviewerIds = getStoredAssignedReviewerIds(request);
  let effectiveReviewerIds = [...assignedReviewerIds];
  const delegatedReviewerIds: string[] = [];

  const delegateRules = listActiveDelegationsForReviewers(
    assignedReviewerIds,
    now,
  ).filter((rule) => rule.mode === "delegate");

  for (const rule of delegateRules) {
    if (!delegatedReviewerIds.includes(rule.toReviewerId)) {
      delegatedReviewerIds.push(rule.toReviewerId);
    }
    effectiveReviewerIds.push(rule.toReviewerId);
  }

  return {
    assignedReviewerIds: sortReviewerIds(assignedReviewerIds),
    effectiveReviewerIds: sortReviewerIds(effectiveReviewerIds),
    delegatedReviewerIds: sortReviewerIds(delegatedReviewerIds),
  };
}

export function recordApprovalAssignmentChange(input: {
  approvalRequestId: string;
  previousReviewerIds: string[];
  nextReviewerIds: string[];
  reason: string;
  changeType: ApprovalAssignmentChangeDto["changeType"];
}): ApprovalAssignmentChangeDto {
  const change: ApprovalAssignmentChangeDto = {
    approvalRequestId: input.approvalRequestId,
    previousReviewerIds: sortReviewerIds(input.previousReviewerIds),
    nextReviewerIds: sortReviewerIds(input.nextReviewerIds),
    reason: input.reason.trim(),
    changedAt: new Date().toISOString(),
    changeType: input.changeType,
  };

  const history = assignmentHistoryByRequest.get(input.approvalRequestId) ?? [];
  history.unshift(change);
  assignmentHistoryByRequest.set(input.approvalRequestId, history);
  return structuredClone(change);
}

export function listApprovalAssignmentHistory(
  approvalRequestId: string,
  now: Date = new Date(),
): ApprovalAssignmentHistoryResponseDto | null {
  const request = findRequest(approvalRequestId);
  if (!request) {
    return null;
  }

  const reviewers = getEffectiveReviewerIds(approvalRequestId, now);
  const changes = assignmentHistoryByRequest.get(approvalRequestId) ?? [];

  return {
    approvalRequestId,
    assignedReviewerIds: reviewers.assignedReviewerIds,
    effectiveReviewerIds: reviewers.effectiveReviewerIds,
    delegatedReviewerIds: reviewers.delegatedReviewerIds,
    total: changes.length,
    changes: changes.map((change) => structuredClone(change)),
  };
}

export function manuallyReassignApprovalRequest(
  id: string,
  nextReviewerIds: string[],
  reason: string,
): { request: ApprovalRequestDto | null; error?: string; change?: ApprovalAssignmentChangeDto } {
  const request = findRequest(id);
  if (!request || request.status !== "pending") {
    return {
      request: null,
      error: "Only pending approval requests can be reassigned.",
    };
  }

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    return { request: null, error: "Reassignment reason is required." };
  }

  const validReviewerIds = sortReviewerIds(
    nextReviewerIds.filter((reviewerId) => {
      const reviewer = getReviewerById(reviewerId);
      return reviewer?.active === true;
    }),
  );

  if (validReviewerIds.length === 0) {
    return {
      request: null,
      error: "At least one active reviewer must be selected for reassignment.",
    };
  }

  const previousReviewerIds = getStoredAssignedReviewerIds(request);
  request.assignedReviewerIds = validReviewerIds;
  touchRequest(request);

  const change = recordApprovalAssignmentChange({
    approvalRequestId: request.id,
    previousReviewerIds,
    nextReviewerIds: validReviewerIds,
    reason: trimmedReason,
    changeType: "reassigned",
  });

  notifyApprovalReassigned({
    approvalRequestId: request.id,
    previousReviewerIds,
    nextReviewerIds: validReviewerIds,
    reason: trimmedReason,
  });

  return { request: cloneRequest(request), change };
}

function createExceptionId(): string {
  const id = `ex-${Date.now()}-${exceptionIdCounter}`;
  exceptionIdCounter += 1;
  return id;
}

function hasOpenException(
  approvalRequestId: string,
  type: ExceptionType,
): boolean {
  return approvalExceptions.some(
    (entry) =>
      entry.approvalRequestId === approvalRequestId &&
      entry.type === type &&
      entry.status === "open",
  );
}

export function createApprovalException(input: {
  approvalRequestId: string;
  type: ExceptionType;
  summary: string;
  metadata?: Record<string, unknown>;
  notifyRecipientId?: string;
}): ApprovalExceptionDto | null {
  if (hasOpenException(input.approvalRequestId, input.type)) {
    return null;
  }

  const request = findRequest(input.approvalRequestId);
  if (!request) {
    return null;
  }

  const exception: ApprovalExceptionDto = {
    id: createExceptionId(),
    approvalRequestId: input.approvalRequestId,
    type: input.type,
    status: "open",
    summary: input.summary,
    createdAt: new Date().toISOString(),
    metadata: input.metadata,
  };

  approvalExceptions.unshift(exception);

  recordAuditLog({
    actionType: "create_approval_exception",
    entityType: "approval_exception",
    entityId: exception.id,
    outcome: "success",
    summary: `Opened exception for ${input.type.replace("_", " ")} on approval ${input.approvalRequestId}`,
    metadata: {
      type: input.type,
      summary: input.summary,
    },
  });

  notifyApprovalExceptionOpened({
    approvalRequestId: input.approvalRequestId,
    exceptionId: exception.id,
    summary: input.summary,
    recipientActorId: input.notifyRecipientId,
  });

  return structuredClone(exception);
}

function maybeScanApprovalExceptions(now: Date = new Date()): void {
  for (const request of approvalRequests) {
    if (request.status !== "pending") {
      continue;
    }

    syncDelegationReassignments(request, now);

    const sla = computeApprovalSlaStatus(request, now);
    if (sla.overdue) {
      createApprovalException({
        approvalRequestId: request.id,
        type: "request_overdue",
        summary: `Approval ${request.id} is overdue (${sla.ageHours}h open).`,
        metadata: { ageHours: sla.ageHours, targetOverdueAt: sla.targetOverdueAt },
      });
    }

    const assigned = request.assignedReviewerIds ?? [];
    for (const reviewerId of assigned) {
      const reviewer = getReviewerById(reviewerId);
      if (!reviewer || !reviewer.active) {
        createApprovalException({
          approvalRequestId: request.id,
          type: "reviewer_unavailable",
          summary: `Assigned reviewer ${reviewerId} is unavailable for approval ${request.id}.`,
          metadata: { reviewerId },
        });
        continue;
      }

      const policy = getApprovalPolicy();
      if (!policy.allowedApproverRoles.includes(reviewer.role)) {
        createApprovalException({
          approvalRequestId: request.id,
          type: "role_mismatch",
          summary: `Assigned reviewer ${reviewerId} has role '${reviewer.role}' which cannot approve approval ${request.id}.`,
          metadata: { reviewerId, role: reviewer.role },
        });
      }
    }
  }
}

export function listOpenApprovalExceptions(): ApprovalExceptionListResponseDto {
  maybeScanApprovalExceptions();

  const open = approvalExceptions.filter((entry) => entry.status === "open");
  const resolved = approvalExceptions.filter((entry) => entry.status === "resolved");

  return {
    total: approvalExceptions.length,
    exceptions: [...open, ...resolved].map((entry) => structuredClone(entry)),
  };
}

export function resolveApprovalException(
  id: string,
  note?: string,
): ApprovalExceptionDto | null {
  const exception = approvalExceptions.find((entry) => entry.id === id);
  if (!exception || exception.status !== "open") {
    return null;
  }

  exception.status = "resolved";
  exception.resolvedAt = new Date().toISOString();
  exception.metadata = {
    ...(exception.metadata ?? {}),
    resolutionNote: note?.trim() || undefined,
  };

  return structuredClone(exception);
}

function getRecipientActorIds(request: ApprovalRequestDto): string[] {
  const { effectiveReviewerIds } = getEffectiveReviewerIds(request.id);
  return effectiveReviewerIds;
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
  const now = new Date();
  for (const request of approvalRequests) {
    syncDelegationReassignments(request, now);
  }

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
      request.assignedReviewerIds.length > 0
    ) {
      const { effectiveReviewerIds } = getEffectiveReviewerIds(request.id);
      if (!effectiveReviewerIds.includes(actor.actorId)) {
        canApprove = false;
        reasons.push(
          "Only assigned, delegated, or reassigned reviewers can approve this request.",
        );
      }
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
