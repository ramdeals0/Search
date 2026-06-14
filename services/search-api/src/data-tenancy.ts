import type {
  AccessRequestDto,
  AccessReviewRunDto,
  ApprovalRequestDto,
  AuditLogEntryDto,
  ExportJobDto,
  JitElevationRequestDto,
  NotificationDto,
  UserDto,
  UserRole,
} from "@retailer-search/shared-types";
import { hasPermissionForUser } from "./rbac.js";

export function canViewAllGovernanceRecords(user: UserDto): boolean {
  return user.role === "admin" || user.role === "reviewer";
}

export function canViewAllAuditLogs(user: UserDto, effectiveRole: UserRole): boolean {
  return hasPermissionForUser(user, "view_audit_logs", effectiveRole);
}

export function canViewAllApprovals(user: UserDto, effectiveRole: UserRole): boolean {
  return hasPermissionForUser(user, "view_approvals", effectiveRole);
}

export function canViewAllExportJobs(user: UserDto): boolean {
  return user.role === "admin";
}

export function filterAccessRequestsForViewer(
  requests: AccessRequestDto[],
  viewer: UserDto,
): AccessRequestDto[] {
  if (canViewAllGovernanceRecords(viewer)) {
    return requests;
  }

  return requests.filter((request) => request.requesterUserId === viewer.id);
}

export function canViewAccessRequest(
  request: AccessRequestDto,
  viewer: UserDto,
): boolean {
  return (
    canViewAllGovernanceRecords(viewer) || request.requesterUserId === viewer.id
  );
}

export function filterJitElevationRequestsForViewer(
  requests: JitElevationRequestDto[],
  viewer: UserDto,
): JitElevationRequestDto[] {
  if (canViewAllGovernanceRecords(viewer)) {
    return requests;
  }

  return requests.filter((request) => request.requesterUserId === viewer.id);
}

export function canViewJitElevationRequest(
  request: JitElevationRequestDto,
  viewer: UserDto,
): boolean {
  return (
    canViewAllGovernanceRecords(viewer) || request.requesterUserId === viewer.id
  );
}

export function sanitizeAccessReviewRunForViewer(
  run: AccessReviewRunDto,
  viewer: UserDto,
): AccessReviewRunDto | null {
  if (canViewAllGovernanceRecords(viewer)) {
    return run;
  }

  const items = run.items.filter((item) => item.userId === viewer.id);
  if (items.length === 0) {
    return null;
  }

  return {
    ...run,
    items,
    summary: undefined,
  };
}

export function filterAccessReviewRunsForViewer(
  runs: AccessReviewRunDto[],
  viewer: UserDto,
): AccessReviewRunDto[] {
  if (canViewAllGovernanceRecords(viewer)) {
    return runs;
  }

  return runs
    .map((run) => sanitizeAccessReviewRunForViewer(run, viewer))
    .filter((run): run is AccessReviewRunDto => run !== null);
}

export function canViewAccessReviewRun(
  run: AccessReviewRunDto,
  viewer: UserDto,
): boolean {
  if (canViewAllGovernanceRecords(viewer)) {
    return true;
  }

  return run.items.some((item) => item.userId === viewer.id);
}

export function filterActivePrivilegesForViewer<T extends { userId: string }>(
  privileges: T[],
  viewer: UserDto,
): T[] {
  if (canViewAllGovernanceRecords(viewer)) {
    return privileges;
  }

  return privileges.filter((privilege) => privilege.userId === viewer.id);
}

function isAuditEntryAboutViewer(
  entry: AuditLogEntryDto,
  viewer: UserDto,
): boolean {
  if (entry.entityType === "user" && entry.entityId === viewer.id) {
    return true;
  }

  if (entry.summary.includes(viewer.email)) {
    return true;
  }

  const metadata = entry.metadata ?? {};
  const requesterUserId =
    typeof metadata.requesterUserId === "string"
      ? metadata.requesterUserId
      : undefined;
  const requesterEmail =
    typeof metadata.requesterEmail === "string"
      ? metadata.requesterEmail
      : undefined;

  return requesterUserId === viewer.id || requesterEmail === viewer.email;
}

export function filterAuditLogsForViewer(
  entries: AuditLogEntryDto[],
  viewer: UserDto,
  effectiveRole: UserRole,
): AuditLogEntryDto[] {
  if (canViewAllAuditLogs(viewer, effectiveRole)) {
    return entries;
  }

  return entries.filter(
    (entry) =>
      entry.actorId === viewer.id || isAuditEntryAboutViewer(entry, viewer),
  );
}

export function filterApprovalsForViewer(
  requests: ApprovalRequestDto[],
  viewer: UserDto,
  effectiveRole: UserRole,
): ApprovalRequestDto[] {
  if (canViewAllApprovals(viewer, effectiveRole)) {
    return requests;
  }

  return requests.filter((request) => request.requestedBy.actorId === viewer.id);
}

export function canViewApprovalRequest(
  request: ApprovalRequestDto,
  viewer: UserDto,
  effectiveRole: UserRole,
): boolean {
  if (canViewAllApprovals(viewer, effectiveRole)) {
    return true;
  }

  return request.requestedBy.actorId === viewer.id;
}

export function filterExportJobsForViewer(
  jobs: ExportJobDto[],
  viewer: UserDto,
): ExportJobDto[] {
  if (canViewAllExportJobs(viewer)) {
    return jobs;
  }

  return jobs.filter((job) => job.createdByUserId === viewer.id);
}

export function filterNotificationsForViewer(
  notifications: NotificationDto[],
  viewer: UserDto,
  effectiveRole: UserRole,
): NotificationDto[] {
  if (canViewAllApprovals(viewer, effectiveRole)) {
    return notifications;
  }

  return notifications.filter(
    (notification) => notification.recipientActorId === viewer.id,
  );
}

export function canViewNotification(
  notification: NotificationDto,
  viewer: UserDto,
  effectiveRole: UserRole,
): boolean {
  if (canViewAllApprovals(viewer, effectiveRole)) {
    return true;
  }

  return notification.recipientActorId === viewer.id;
}
