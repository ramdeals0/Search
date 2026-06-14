import type { UserRole, WorkspaceRole } from "@retailer-search/shared-types";

export const ROLE_RANK: Record<UserRole, number> = {
  developer: 0,
  merchandiser: 1,
  reviewer: 2,
  approver: 3,
  release_manager: 4,
  admin: 5,
};

export function clampWorkspaceRole(
  requested: WorkspaceRole,
  effectiveRole: UserRole,
): WorkspaceRole {
  if (ROLE_RANK[requested] <= ROLE_RANK[effectiveRole]) {
    return requested;
  }

  return effectiveRole as WorkspaceRole;
}

export function listAllowedWorkspaceRoles(
  effectiveRole: UserRole,
): WorkspaceRole[] {
  return (Object.keys(ROLE_RANK) as UserRole[])
    .filter((role) => ROLE_RANK[role] <= ROLE_RANK[effectiveRole])
    .sort((left, right) => ROLE_RANK[left] - ROLE_RANK[right]) as WorkspaceRole[];
}

export function assertWorkspaceRoleAllowed(
  requested: WorkspaceRole,
  effectiveRole: UserRole,
): { allowed: boolean; error?: string } {
  if (ROLE_RANK[requested] > ROLE_RANK[effectiveRole]) {
    return {
      allowed: false,
      error: `Workspace role "${requested}" exceeds your effective role (${effectiveRole})`,
    };
  }

  return { allowed: true };
}

export function normalizeJitApprovalRequiredRoles(
  elevatableRoles: UserRole[],
  approvalRequiredRoles: UserRole[],
): UserRole[] {
  return [...new Set([...approvalRequiredRoles, ...elevatableRoles])];
}
