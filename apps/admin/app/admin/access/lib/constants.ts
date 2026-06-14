import type { UserRole } from "@retailer-search/shared-types";

export const ALL_USER_ROLES: UserRole[] = [
  "merchandiser",
  "reviewer",
  "approver",
  "release_manager",
  "admin",
];

export const ELEVATABLE_ROLES: UserRole[] = [
  "reviewer",
  "approver",
  "release_manager",
  "admin",
];

export const PRIVILEGED_ROLES: UserRole[] = ["admin", "release_manager"];
