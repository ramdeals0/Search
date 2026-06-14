import type { UserRole, WorkspaceRole } from "@retailer-search/shared-types";

export const ALL_WORKSPACE_ROLES: WorkspaceRole[] = [
  "merchandiser",
  "reviewer",
  "approver",
  "release_manager",
  "developer",
  "admin",
];

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

export function canSelectWorkspaceRole(
  requested: WorkspaceRole,
  effectiveRole: UserRole,
): boolean {
  return ROLE_RANK[requested] <= ROLE_RANK[effectiveRole];
}

export function listSelectableWorkspaceRoles(
  effectiveRole: UserRole,
): WorkspaceRole[] {
  return ALL_WORKSPACE_ROLES.filter((role) =>
    canSelectWorkspaceRole(role, effectiveRole),
  );
}

export function resolveStoredWorkspaceRole(
  stored: string | null,
  effectiveRole: UserRole,
): WorkspaceRole {
  const fallback = clampWorkspaceRole("merchandiser", effectiveRole);
  if (
    !stored ||
    !ALL_WORKSPACE_ROLES.includes(stored as WorkspaceRole)
  ) {
    return fallback;
  }

  return clampWorkspaceRole(stored as WorkspaceRole, effectiveRole);
}
