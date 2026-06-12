import type {
  PermissionKey,
  RolePermissionsDto,
  UserDto,
  UserRole,
} from "@retailer-search/shared-types";

const ALL_PERMISSIONS: PermissionKey[] = [
  "view_dashboard",
  "manage_rules",
  "manage_synonyms",
  "view_approvals",
  "approve_release",
  "execute_release",
  "manage_reviewers",
  "manage_policy",
  "manage_snapshots",
  "promote_live",
  "view_audit_logs",
  "manage_saved_views",
  "comment",
  "annotate",
];

export const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  merchandiser: [
    "view_dashboard",
    "manage_rules",
    "manage_synonyms",
    "manage_snapshots",
    "manage_saved_views",
    "comment",
    "annotate",
  ],
  reviewer: ["view_dashboard", "view_approvals", "comment", "annotate"],
  approver: [
    "view_dashboard",
    "view_approvals",
    "approve_release",
    "comment",
    "annotate",
  ],
  release_manager: [
    "view_dashboard",
    "view_approvals",
    "execute_release",
    "promote_live",
    "manage_snapshots",
    "view_audit_logs",
    "comment",
    "annotate",
  ],
  admin: [...ALL_PERMISSIONS],
};

export class PermissionDeniedError extends Error {
  readonly permission: PermissionKey;

  constructor(permission: PermissionKey) {
    super(`Missing permission: ${permission}`);
    this.name = "PermissionDeniedError";
    this.permission = permission;
  }
}

export function listRolePermissions(): RolePermissionsDto[] {
  return (Object.keys(ROLE_PERMISSIONS) as UserRole[]).map((role) => ({
    role,
    permissions: [...ROLE_PERMISSIONS[role]],
  }));
}

export function hasPermission(role: UserRole, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasPermissionForUser(
  user: UserDto,
  permission: PermissionKey,
  effectiveRole?: UserRole,
): boolean {
  const role = effectiveRole ?? user.role;
  return hasPermission(role, permission);
}

export function requirePermission(
  user: UserDto,
  permission: PermissionKey,
  effectiveRole?: UserRole,
): void {
  if (!hasPermissionForUser(user, permission, effectiveRole)) {
    throw new PermissionDeniedError(permission);
  }
}

export function getPermissionDeniedMessage(permission: PermissionKey): string {
  return `You do not have permission to perform this action (${permission})`;
}

export function getPermissionsForRole(role: UserRole): PermissionKey[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function getPermissionsForUser(
  user: UserDto,
  effectiveRole?: UserRole,
): PermissionKey[] {
  return getPermissionsForRole(effectiveRole ?? user.role);
}
