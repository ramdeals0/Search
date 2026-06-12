import type {
  AccessRequestDto,
  AccessReviewItemDto,
  AccessReviewRunDto,
  CreateAccessRequestDto,
  UserDto,
  UserRole,
} from "@retailer-search/shared-types";
import { disableUser, getUserById, updateUserRole } from "./auth-store.js";
import { prisma } from "./db.js";

const ALL_ROLES: UserRole[] = [
  "merchandiser",
  "reviewer",
  "approver",
  "release_manager",
  "admin",
];

const PRIVILEGED_ROLES: UserRole[] = ["admin", "release_manager"];

const ROLE_DOWNGRADE: Record<UserRole, UserRole> = {
  admin: "release_manager",
  release_manager: "approver",
  approver: "reviewer",
  reviewer: "merchandiser",
  merchandiser: "merchandiser",
};

const STALE_LOGIN_DAYS = 90;

const accessRequests: AccessRequestDto[] = [];
const accessReviewRuns: AccessReviewRunDto[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

function createAccessRequestId(): string {
  return `req_${Date.now()}_${accessRequests.length + 1}`;
}

function createAccessReviewId(): string {
  return `review_${Date.now()}_${accessReviewRuns.length + 1}`;
}

function cloneRequest(request: AccessRequestDto): AccessRequestDto {
  return structuredClone(request);
}

function cloneReviewRun(run: AccessReviewRunDto): AccessReviewRunDto {
  return structuredClone(run);
}

function sortNewestFirst<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function mapAccessRequestRowToDto(row: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  requesterUserId: string;
  requesterEmail: string;
  requesterName: string;
  requestedRole: UserRole;
  justification: string;
  status: AccessRequestDto["status"];
  reviewerUserId: string | null;
  reviewerName: string | null;
  reviewerNote: string | null;
}): AccessRequestDto {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    requesterUserId: row.requesterUserId,
    requesterEmail: row.requesterEmail,
    requesterName: row.requesterName,
    requestedRole: row.requestedRole,
    justification: row.justification,
    status: row.status,
    reviewerUserId: row.reviewerUserId ?? undefined,
    reviewerName: row.reviewerName ?? undefined,
    reviewerNote: row.reviewerNote ?? undefined,
  };
}

function mapReviewItemRowToDto(row: {
  userId: string;
  userEmail: string;
  userName: string;
  currentRole: UserRole;
  active: boolean;
  lastLoginAt: Date | null;
  recommendedAction: string | null;
  note: string | null;
}): AccessReviewItemDto {
  return {
    userId: row.userId,
    userEmail: row.userEmail,
    userName: row.userName,
    currentRole: row.currentRole,
    active: row.active,
    lastLoginAt: row.lastLoginAt?.toISOString(),
    recommendedAction:
      (row.recommendedAction as AccessReviewItemDto["recommendedAction"]) ??
      undefined,
    note: row.note ?? undefined,
  };
}

function mapAccessReviewRunRowToDto(row: {
  id: string;
  createdAt: Date;
  createdByUserId: string;
  createdByName: string;
  status: AccessReviewRunDto["status"];
  scopeRoles: unknown;
  completedAt: Date | null;
  summary: unknown;
  items: Array<{
    userId: string;
    userEmail: string;
    userName: string;
    currentRole: UserRole;
    active: boolean;
    lastLoginAt: Date | null;
    recommendedAction: string | null;
    note: string | null;
  }>;
}): AccessReviewRunDto {
  const scopeRoles = row.scopeRoles as UserRole[];
  const summary = row.summary as AccessReviewRunDto["summary"] | null;

  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    createdByUserId: row.createdByUserId,
    createdByName: row.createdByName,
    status: row.status,
    scope: { roles: scopeRoles },
    items: row.items.map(mapReviewItemRowToDto),
    completedAt: row.completedAt?.toISOString(),
    summary: summary ?? undefined,
  };
}

function persistAccessRequest(request: AccessRequestDto): void {
  void prisma.accessRequest
    .upsert({
      where: { id: request.id },
      create: {
        id: request.id,
        createdAt: new Date(request.createdAt),
        updatedAt: new Date(request.updatedAt),
        requesterUserId: request.requesterUserId,
        requesterEmail: request.requesterEmail,
        requesterName: request.requesterName,
        requestedRole: request.requestedRole,
        justification: request.justification,
        status: request.status,
        reviewerUserId: request.reviewerUserId,
        reviewerName: request.reviewerName,
        reviewerNote: request.reviewerNote,
      },
      update: {
        updatedAt: new Date(request.updatedAt),
        status: request.status,
        reviewerUserId: request.reviewerUserId,
        reviewerName: request.reviewerName,
        reviewerNote: request.reviewerNote,
      },
    })
    .catch((error: unknown) => {
      console.error("Failed to persist access request", request.id, error);
    });
}

function persistAccessReviewRun(run: AccessReviewRunDto): void {
  void (async () => {
    try {
      await prisma.accessReviewRun.upsert({
        where: { id: run.id },
        create: {
          id: run.id,
          createdAt: new Date(run.createdAt),
          updatedAt: new Date(run.completedAt ?? run.createdAt),
          createdByUserId: run.createdByUserId,
          createdByName: run.createdByName,
          status: run.status,
          scopeRoles: run.scope.roles,
          completedAt: run.completedAt ? new Date(run.completedAt) : null,
          summary: run.summary ?? undefined,
        },
        update: {
          updatedAt: new Date(),
          status: run.status,
          completedAt: run.completedAt ? new Date(run.completedAt) : null,
          summary: run.summary ?? undefined,
        },
      });

      await prisma.accessReviewItem.deleteMany({ where: { runId: run.id } });

      if (run.items.length > 0) {
        await prisma.accessReviewItem.createMany({
          data: run.items.map((item) => ({
            runId: run.id,
            userId: item.userId,
            userEmail: item.userEmail,
            userName: item.userName,
            currentRole: item.currentRole,
            active: item.active,
            lastLoginAt: item.lastLoginAt ? new Date(item.lastLoginAt) : null,
            recommendedAction: item.recommendedAction,
            note: item.note,
          })),
        });
      }
    } catch (error: unknown) {
      console.error("Failed to persist access review run", run.id, error);
    }
  })();
}

export async function hydrateAccessGovernanceStore(): Promise<void> {
  accessRequests.length = 0;
  accessReviewRuns.length = 0;

  const requests = await prisma.accessRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
  for (const row of requests) {
    accessRequests.push(mapAccessRequestRowToDto(row));
  }

  const runs = await prisma.accessReviewRun.findMany({
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  for (const row of runs) {
    accessReviewRuns.push(mapAccessReviewRunRowToDto(row));
  }
}

function computeRecommendedAction(
  user: UserDto,
): AccessReviewItemDto["recommendedAction"] {
  if (!user.active) {
    return "disable";
  }

  if (!user.lastLoginAt) {
    return "review";
  }

  const daysSinceLogin =
    (Date.now() - new Date(user.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceLogin > STALE_LOGIN_DAYS) {
    return "review";
  }

  if (PRIVILEGED_ROLES.includes(user.role)) {
    return "review";
  }

  return "keep";
}

function buildReviewItem(user: UserDto): AccessReviewItemDto {
  return {
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    currentRole: user.role,
    active: user.active,
    lastLoginAt: user.lastLoginAt,
    recommendedAction: computeRecommendedAction(user),
  };
}

export function createAccessRequest(
  requester: UserDto,
  input: CreateAccessRequestDto,
): { success: boolean; request?: AccessRequestDto; error?: string } {
  const justification = input.justification.trim();
  if (justification.length < 8) {
    return { success: false, error: "Justification must be at least 8 characters" };
  }

  if (requester.role === input.requestedRole) {
    return { success: false, error: "You already have the requested role" };
  }

  const duplicatePending = accessRequests.find(
    (request) =>
      request.requesterUserId === requester.id &&
      request.requestedRole === input.requestedRole &&
      request.status === "pending",
  );
  if (duplicatePending) {
    return {
      success: false,
      error: "A pending request for this role already exists",
    };
  }

  const timestamp = nowIso();
  const request: AccessRequestDto = {
    id: createAccessRequestId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    requesterUserId: requester.id,
    requesterEmail: requester.email,
    requesterName: requester.name,
    requestedRole: input.requestedRole,
    justification,
    status: "pending",
  };

  accessRequests.push(request);
  persistAccessRequest(request);
  return { success: true, request: cloneRequest(request) };
}

export function listAccessRequests(): AccessRequestListResponse {
  return {
    total: accessRequests.length,
    requests: sortNewestFirst(accessRequests).map(cloneRequest),
  };
}

export function getAccessRequestById(id: string): AccessRequestDto | null {
  const request = accessRequests.find((entry) => entry.id === id);
  return request ? cloneRequest(request) : null;
}

export function resolveAccessRequest(
  id: string,
  decision: "approved" | "denied" | "cancelled",
  actor: UserDto,
  reviewerNote?: string,
): { success: boolean; request?: AccessRequestDto; error?: string } {
  const request = accessRequests.find((entry) => entry.id === id);
  if (!request) {
    return { success: false, error: "Access request not found" };
  }

  if (request.status !== "pending") {
    return { success: false, error: "Only pending access requests can be resolved" };
  }

  const isRequester = request.requesterUserId === actor.id;
  const isAdmin = actor.role === "admin";

  if (decision === "cancelled") {
    if (!isRequester && !isAdmin) {
      return {
        success: false,
        error: "Only the requester or an admin can cancel this request",
      };
    }
  } else if (!isAdmin) {
    return { success: false, error: "Only admins can approve or deny access requests" };
  }

  request.status = decision;
  request.updatedAt = nowIso();
  request.reviewerUserId = actor.id;
  request.reviewerName = actor.name;
  request.reviewerNote = reviewerNote?.trim() || undefined;

  if (decision === "approved") {
    const updatedUser = updateUserRole(request.requesterUserId, request.requestedRole);
    if (!updatedUser) {
      request.status = "pending";
      request.reviewerUserId = undefined;
      request.reviewerName = undefined;
      request.reviewerNote = undefined;
      return { success: false, error: "Requester user not found" };
    }
  }

  persistAccessRequest(request);
  return { success: true, request: cloneRequest(request) };
}

export interface AccessRequestListResponse {
  total: number;
  requests: AccessRequestDto[];
}

export function createAccessReviewRun(
  createdBy: UserDto,
  users: UserDto[],
  roles?: UserRole[],
): AccessReviewRunDto {
  const scopedRoles =
    roles && roles.length > 0 ? [...new Set(roles)] : [...ALL_ROLES];

  const scopedUsers = users.filter((user) => scopedRoles.includes(user.role));
  const timestamp = nowIso();

  const run: AccessReviewRunDto = {
    id: createAccessReviewId(),
    createdAt: timestamp,
    createdByUserId: createdBy.id,
    createdByName: createdBy.name,
    status: "open",
    scope: { roles: scopedRoles },
    items: scopedUsers.map(buildReviewItem),
  };

  accessReviewRuns.push(run);
  persistAccessReviewRun(run);
  return cloneReviewRun(run);
}

export function listAccessReviewRuns(): AccessReviewListResponse {
  return {
    total: accessReviewRuns.length,
    runs: sortNewestFirst(accessReviewRuns).map(cloneReviewRun),
  };
}

export interface AccessReviewListResponse {
  total: number;
  runs: AccessReviewRunDto[];
}

export function getAccessReviewRunById(id: string): AccessReviewRunDto | null {
  const run = accessReviewRuns.find((entry) => entry.id === id);
  return run ? cloneReviewRun(run) : null;
}

export function resolveAccessReviewItem(
  runId: string,
  userId: string,
  action: "keep" | "downgrade" | "disable",
  note?: string,
): {
  success: boolean;
  run?: AccessReviewRunDto;
  previousRole?: UserRole;
  nextRole?: UserRole;
  error?: string;
} {
  const run = accessReviewRuns.find((entry) => entry.id === runId);
  if (!run) {
    return { success: false, error: "Access review run not found" };
  }

  if (run.status !== "open") {
    return { success: false, error: "Only open access review runs can be updated" };
  }

  const item = run.items.find((entry) => entry.userId === userId);
  if (!item) {
    return { success: false, error: "User is not in this access review run" };
  }

  const user = getUserById(userId);
  if (!user) {
    return { success: false, error: "User not found" };
  }

  const previousRole = user.role;
  let nextRole = previousRole;

  if (action === "keep") {
    item.note = note?.trim() || item.note;
    persistAccessReviewRun(run);
    return { success: true, run: cloneReviewRun(run), previousRole, nextRole };
  }

  if (action === "disable") {
    const disabled = disableUser(userId);
    if (!disabled) {
      return { success: false, error: "Failed to disable user" };
    }
    item.active = false;
    item.currentRole = disabled.role;
    item.note = note?.trim() || item.note;
    item.recommendedAction = "disable";
    persistAccessReviewRun(run);
    return {
      success: true,
      run: cloneReviewRun(run),
      previousRole,
      nextRole: disabled.role,
    };
  }

  nextRole = ROLE_DOWNGRADE[previousRole];
  const updated = updateUserRole(userId, nextRole);
  if (!updated) {
    return { success: false, error: "Failed to downgrade user role" };
  }

  item.currentRole = updated.role;
  item.note = note?.trim() || item.note;
  item.recommendedAction = "keep";
  persistAccessReviewRun(run);
  return {
    success: true,
    run: cloneReviewRun(run),
    previousRole,
    nextRole: updated.role,
  };
}

export function completeAccessReviewRun(
  runId: string,
): { success: boolean; run?: AccessReviewRunDto; error?: string } {
  const run = accessReviewRuns.find((entry) => entry.id === runId);
  if (!run) {
    return { success: false, error: "Access review run not found" };
  }

  if (run.status === "completed") {
    return { success: false, error: "Access review run is already completed" };
  }

  run.status = "completed";
  run.completedAt = nowIso();
  run.summary = {
    totalUsers: run.items.length,
    adminsReviewed: run.items.filter((item) =>
      PRIVILEGED_ROLES.includes(item.currentRole),
    ).length,
    inactiveUsersFlagged: run.items.filter((item) => !item.active).length,
  };

  persistAccessReviewRun(run);
  return { success: true, run: cloneReviewRun(run) };
}
