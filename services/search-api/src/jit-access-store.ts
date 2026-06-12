import type {
  ActivePrivilegeDto,
  CreateJitElevationRequestDto,
  JitElevationRequestDto,
  JitPolicyDto,
  UpdateJitPolicyRequestDto,
  UserDto,
  UserRole,
} from "@retailer-search/shared-types";
import { prisma } from "./db.js";

const ROLE_RANK: Record<UserRole, number> = {
  merchandiser: 1,
  reviewer: 2,
  approver: 3,
  release_manager: 4,
  admin: 5,
};

const DEFAULT_POLICY: JitPolicyDto = {
  enabled: true,
  defaultDurationMinutes: 30,
  maxDurationMinutes: 120,
  approvalRequiredRoles: ["admin", "release_manager"],
  elevatableRoles: ["reviewer", "approver", "release_manager", "admin"],
};

/** In-memory only: JIT policy is not persisted in SQLite MVP. */
let jitPolicy: JitPolicyDto = structuredClone(DEFAULT_POLICY);
const jitRequests: JitElevationRequestDto[] = [];

function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

function cloneRequest(request: JitElevationRequestDto): JitElevationRequestDto {
  return structuredClone(request);
}

function clonePolicy(policy: JitPolicyDto): JitPolicyDto {
  return structuredClone(policy);
}

function sortNewestFirst(requests: JitElevationRequestDto[]): JitElevationRequestDto[] {
  return [...requests].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function createRequestId(): string {
  return `jit_${Date.now()}_${jitRequests.length + 1}`;
}

function mapJitRowToDto(row: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  requesterUserId: string;
  requesterEmail: string;
  requesterName: string;
  baseRole: UserRole;
  requestedRole: UserRole;
  justification: string;
  requestedDurationMinutes: number;
  status: JitElevationRequestDto["status"];
  approvedByUserId: string | null;
  approvedByName: string | null;
  reviewerNote: string | null;
  activatedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
}): JitElevationRequestDto {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    requesterUserId: row.requesterUserId,
    requesterEmail: row.requesterEmail,
    requesterName: row.requesterName,
    baseRole: row.baseRole,
    requestedRole: row.requestedRole,
    justification: row.justification,
    requestedDurationMinutes: row.requestedDurationMinutes,
    status: row.status,
    approvedByUserId: row.approvedByUserId ?? undefined,
    approvedByName: row.approvedByName ?? undefined,
    reviewerNote: row.reviewerNote ?? undefined,
    activatedAt: row.activatedAt?.toISOString(),
    expiresAt: row.expiresAt?.toISOString(),
    revokedAt: row.revokedAt?.toISOString(),
  };
}

function persistJitRequest(request: JitElevationRequestDto): void {
  void prisma.jitElevationRequest
    .upsert({
      where: { id: request.id },
      create: {
        id: request.id,
        createdAt: new Date(request.createdAt),
        updatedAt: new Date(request.updatedAt),
        requesterUserId: request.requesterUserId,
        requesterEmail: request.requesterEmail,
        requesterName: request.requesterName,
        baseRole: request.baseRole,
        requestedRole: request.requestedRole,
        justification: request.justification,
        requestedDurationMinutes: request.requestedDurationMinutes,
        status: request.status,
        approvedByUserId: request.approvedByUserId,
        approvedByName: request.approvedByName,
        reviewerNote: request.reviewerNote,
        activatedAt: request.activatedAt ? new Date(request.activatedAt) : null,
        expiresAt: request.expiresAt ? new Date(request.expiresAt) : null,
        revokedAt: request.revokedAt ? new Date(request.revokedAt) : null,
      },
      update: {
        updatedAt: new Date(request.updatedAt),
        status: request.status,
        approvedByUserId: request.approvedByUserId,
        approvedByName: request.approvedByName,
        reviewerNote: request.reviewerNote,
        activatedAt: request.activatedAt ? new Date(request.activatedAt) : null,
        expiresAt: request.expiresAt ? new Date(request.expiresAt) : null,
        revokedAt: request.revokedAt ? new Date(request.revokedAt) : null,
      },
    })
    .catch((error: unknown) => {
      console.error("Failed to persist JIT request", request.id, error);
    });
}

export async function hydrateJitAccessStore(): Promise<void> {
  jitRequests.length = 0;
  const rows = await prisma.jitElevationRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
  for (const row of rows) {
    jitRequests.push(mapJitRowToDto(row));
  }
}

function activateRequest(
  request: JitElevationRequestDto,
  now: Date,
  reviewer?: UserDto,
): void {
  const activatedAt = nowIso(now);
  const expiresAt = new Date(
    now.getTime() + request.requestedDurationMinutes * 60 * 1000,
  ).toISOString();

  request.status = "active";
  request.updatedAt = activatedAt;
  request.activatedAt = activatedAt;
  request.expiresAt = expiresAt;
  request.revokedAt = undefined;

  if (reviewer) {
    request.approvedByUserId = reviewer.id;
    request.approvedByName = reviewer.name;
  }
}

function findActiveRequestForUser(
  userId: string,
  now: Date,
): JitElevationRequestDto | null {
  const activeRequests = jitRequests.filter(
    (request) =>
      request.requesterUserId === userId &&
      request.status === "active" &&
      request.expiresAt &&
      new Date(request.expiresAt).getTime() > now.getTime(),
  );

  if (activeRequests.length === 0) {
    return null;
  }

  return activeRequests.reduce((best, current) =>
    ROLE_RANK[current.requestedRole] > ROLE_RANK[best.requestedRole]
      ? current
      : best,
  );
}

function requiresApproval(requestedRole: UserRole): boolean {
  return jitPolicy.approvalRequiredRoles.includes(requestedRole);
}

export function getJitPolicy(): JitPolicyDto {
  return clonePolicy(jitPolicy);
}

export function updateJitPolicy(input: UpdateJitPolicyRequestDto): JitPolicyDto {
  if (input.defaultDurationMinutes < 1) {
    throw new Error("defaultDurationMinutes must be at least 1");
  }

  if (input.maxDurationMinutes < input.defaultDurationMinutes) {
    throw new Error(
      "maxDurationMinutes must be greater than or equal to defaultDurationMinutes",
    );
  }

  if (input.elevatableRoles.length === 0) {
    throw new Error("At least one elevatable role is required");
  }

  jitPolicy = clonePolicy(input);
  return clonePolicy(jitPolicy);
}

export function createJitElevationRequest(
  input: CreateJitElevationRequestDto,
  requester: UserDto,
  now: Date = new Date(),
): { success: boolean; request?: JitElevationRequestDto; error?: string } {
  if (!jitPolicy.enabled) {
    return { success: false, error: "JIT elevation is currently disabled" };
  }

  const justification = input.justification.trim();
  if (justification.length < 8) {
    return { success: false, error: "Justification must be at least 8 characters" };
  }

  if (!jitPolicy.elevatableRoles.includes(input.requestedRole)) {
    return {
      success: false,
      error: `Role ${input.requestedRole} is not available for JIT elevation`,
    };
  }

  if (ROLE_RANK[input.requestedRole] <= ROLE_RANK[requester.role]) {
    return {
      success: false,
      error: "Requested role must be higher than your standing role",
    };
  }

  const durationMinutes =
    input.requestedDurationMinutes > 0
      ? input.requestedDurationMinutes
      : jitPolicy.defaultDurationMinutes;

  if (durationMinutes > jitPolicy.maxDurationMinutes) {
    return {
      success: false,
      error: `Requested duration cannot exceed ${jitPolicy.maxDurationMinutes} minutes`,
    };
  }

  const existingActive = findActiveRequestForUser(requester.id, now);
  if (existingActive) {
    return {
      success: false,
      error: "You already have an active JIT elevation",
    };
  }

  const pendingDuplicate = jitRequests.find(
    (request) =>
      request.requesterUserId === requester.id &&
      request.status === "pending" &&
      request.requestedRole === input.requestedRole,
  );
  if (pendingDuplicate) {
    return {
      success: false,
      error: "A pending JIT request for this role already exists",
    };
  }

  const timestamp = nowIso(now);
  const request: JitElevationRequestDto = {
    id: createRequestId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    requesterUserId: requester.id,
    requesterEmail: requester.email,
    requesterName: requester.name,
    baseRole: requester.role,
    requestedRole: input.requestedRole,
    justification,
    requestedDurationMinutes: durationMinutes,
    status: "pending",
  };

  if (!requiresApproval(input.requestedRole)) {
    activateRequest(request, now);
  }

  jitRequests.push(request);
  persistJitRequest(request);
  return { success: true, request: cloneRequest(request) };
}

export function listJitElevationRequests(): {
  total: number;
  requests: JitElevationRequestDto[];
} {
  return {
    total: jitRequests.length,
    requests: sortNewestFirst(jitRequests).map(cloneRequest),
  };
}

export function getJitElevationRequestById(id: string): JitElevationRequestDto | null {
  const request = jitRequests.find((entry) => entry.id === id);
  return request ? cloneRequest(request) : null;
}

export function resolveJitElevationRequest(
  id: string,
  decision: "approve" | "deny" | "cancel",
  reviewer: UserDto,
  reviewerNote?: string,
  now: Date = new Date(),
): { success: boolean; request?: JitElevationRequestDto; error?: string } {
  const request = jitRequests.find((entry) => entry.id === id);
  if (!request) {
    return { success: false, error: "JIT elevation request not found" };
  }

  if (request.status !== "pending") {
    return { success: false, error: "Only pending JIT requests can be resolved" };
  }

  const isRequester = request.requesterUserId === reviewer.id;
  const isAdmin = reviewer.role === "admin";

  if (decision === "cancel") {
    if (!isRequester && !isAdmin) {
      return {
        success: false,
        error: "Only the requester or an admin can cancel this JIT request",
      };
    }

    request.status = "cancelled";
    request.updatedAt = nowIso(now);
    request.reviewerNote = reviewerNote?.trim() || undefined;
    request.approvedByUserId = reviewer.id;
    request.approvedByName = reviewer.name;
    persistJitRequest(request);
    return { success: true, request: cloneRequest(request) };
  }

  if (!isAdmin) {
    return { success: false, error: "Only admins can approve or deny JIT requests" };
  }

  request.updatedAt = nowIso(now);
  request.approvedByUserId = reviewer.id;
  request.approvedByName = reviewer.name;
  request.reviewerNote = reviewerNote?.trim() || undefined;

  if (decision === "deny") {
    request.status = "denied";
    persistJitRequest(request);
    return { success: true, request: cloneRequest(request) };
  }

  const existingActive = findActiveRequestForUser(request.requesterUserId, now);
  if (existingActive) {
    return {
      success: false,
      error: "Requester already has an active JIT elevation",
    };
  }

  activateRequest(request, now, reviewer);
  persistJitRequest(request);
  return { success: true, request: cloneRequest(request) };
}

export function expireJitAccess(now: Date = new Date()): JitElevationRequestDto[] {
  const expiredRequests: JitElevationRequestDto[] = [];

  for (const request of jitRequests) {
    if (request.status !== "active" || !request.expiresAt) {
      continue;
    }

    if (new Date(request.expiresAt).getTime() <= now.getTime()) {
      request.status = "expired";
      request.updatedAt = nowIso(now);
      expiredRequests.push(cloneRequest(request));
      persistJitRequest(request);
    }
  }

  return expiredRequests;
}

export function revokeJitAccess(
  id: string,
  reviewer?: UserDto,
  now: Date = new Date(),
): { success: boolean; request?: JitElevationRequestDto; error?: string } {
  const request = jitRequests.find((entry) => entry.id === id);
  if (!request) {
    return { success: false, error: "JIT elevation request not found" };
  }

  if (request.status !== "active") {
    return { success: false, error: "Only active JIT elevations can be revoked" };
  }

  request.status = "revoked";
  request.updatedAt = nowIso(now);
  request.revokedAt = nowIso(now);

  if (reviewer) {
    request.approvedByUserId = reviewer.id;
    request.approvedByName = reviewer.name;
  }

  persistJitRequest(request);
  return { success: true, request: cloneRequest(request) };
}

export function getEffectiveRoleForUser(
  user: UserDto,
  now: Date = new Date(),
): UserRole {
  const activeRequest = findActiveRequestForUser(user.id, now);
  if (!activeRequest) {
    return user.role;
  }

  return ROLE_RANK[activeRequest.requestedRole] > ROLE_RANK[user.role]
    ? activeRequest.requestedRole
    : user.role;
}

export function getActivePrivilegeForUser(
  user: UserDto,
  now: Date = new Date(),
): ActivePrivilegeDto {
  const effectiveRole = getEffectiveRoleForUser(user, now);
  const activeRequest = findActiveRequestForUser(user.id, now);

  if (!activeRequest || effectiveRole === user.role) {
    return {
      userId: user.id,
      email: user.email,
      baseRole: user.role,
      effectiveRole: user.role,
      source: "standing",
    };
  }

  return {
    userId: user.id,
    email: user.email,
    baseRole: user.role,
    effectiveRole,
    source: "jit",
    elevatedByRequestId: activeRequest.id,
    activatedAt: activeRequest.activatedAt,
    expiresAt: activeRequest.expiresAt,
  };
}

export function getActivePrivileges(now: Date = new Date()): ActivePrivilegeDto[] {
  expireJitAccess(now);

  const privileges = new Map<string, ActivePrivilegeDto>();

  for (const request of jitRequests) {
    if (request.status !== "active" || !request.expiresAt) {
      continue;
    }

    if (new Date(request.expiresAt).getTime() <= now.getTime()) {
      continue;
    }

    const privilege: ActivePrivilegeDto = {
      userId: request.requesterUserId,
      email: request.requesterEmail,
      baseRole: request.baseRole,
      effectiveRole: request.requestedRole,
      source: "jit",
      elevatedByRequestId: request.id,
      activatedAt: request.activatedAt,
      expiresAt: request.expiresAt,
    };

    const existing = privileges.get(request.requesterUserId);
    if (
      !existing ||
      ROLE_RANK[privilege.effectiveRole] > ROLE_RANK[existing.effectiveRole]
    ) {
      privileges.set(request.requesterUserId, privilege);
    }
  }

  return [...privileges.values()].sort((left, right) =>
    left.email.localeCompare(right.email),
  );
}
