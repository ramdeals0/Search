import type { UserRole } from "./user-role.js";

type ISODateString = string;

export type AccessRequestStatus = "pending" | "approved" | "denied" | "cancelled";

export type AccessReviewStatus = "open" | "completed";

export interface AccessRequestDto {
  id: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  requesterUserId: string;
  requesterEmail: string;
  requesterName: string;
  requestedRole: UserRole;
  justification: string;
  status: AccessRequestStatus;
  reviewerUserId?: string;
  reviewerName?: string;
  reviewerNote?: string;
}

export interface CreateAccessRequestDto {
  requestedRole: UserRole;
  justification: string;
}

export interface ResolveAccessRequestDto {
  decision: "approved" | "denied" | "cancelled";
  reviewerNote?: string;
}

export interface AccessReviewItemDto {
  userId: string;
  userEmail: string;
  userName: string;
  currentRole: UserRole;
  active: boolean;
  lastLoginAt?: ISODateString;
  recommendedAction?: "keep" | "downgrade" | "disable" | "review";
  note?: string;
}

export interface AccessReviewRunDto {
  id: string;
  createdAt: ISODateString;
  createdByUserId: string;
  createdByName: string;
  status: AccessReviewStatus;
  scope: {
    roles: UserRole[];
  };
  items: AccessReviewItemDto[];
  completedAt?: ISODateString;
  summary?: {
    totalUsers: number;
    adminsReviewed: number;
    inactiveUsersFlagged: number;
  };
}

export interface CreateAccessReviewRunDto {
  roles?: UserRole[];
}

export interface ResolveAccessReviewItemDto {
  userId: string;
  action: "keep" | "downgrade" | "disable";
  note?: string;
}

export interface AccessRequestListResponseDto {
  total: number;
  requests: AccessRequestDto[];
}

export interface AccessReviewListResponseDto {
  total: number;
  runs: AccessReviewRunDto[];
}

export type JitAccessStatus =
  | "pending"
  | "active"
  | "denied"
  | "expired"
  | "cancelled"
  | "revoked";

export interface JitElevationRequestDto {
  id: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  requesterUserId: string;
  requesterEmail: string;
  requesterName: string;
  baseRole: UserRole;
  requestedRole: UserRole;
  justification: string;
  requestedDurationMinutes: number;
  status: JitAccessStatus;
  approvedByUserId?: string;
  approvedByName?: string;
  reviewerNote?: string;
  activatedAt?: ISODateString;
  expiresAt?: ISODateString;
  revokedAt?: ISODateString;
}

export interface CreateJitElevationRequestDto {
  requestedRole: UserRole;
  justification: string;
  requestedDurationMinutes: number;
}

export interface ResolveJitElevationRequestDto {
  decision: "approve" | "deny" | "cancel";
  reviewerNote?: string;
}

export interface ActivePrivilegeDto {
  userId: string;
  email: string;
  baseRole: UserRole;
  effectiveRole: UserRole;
  source: "standing" | "jit";
  elevatedByRequestId?: string;
  activatedAt?: ISODateString;
  expiresAt?: ISODateString;
}

export interface JitPolicyDto {
  enabled: boolean;
  defaultDurationMinutes: number;
  maxDurationMinutes: number;
  approvalRequiredRoles: UserRole[];
  elevatableRoles: UserRole[];
}

export interface UpdateJitPolicyRequestDto {
  enabled: boolean;
  defaultDurationMinutes: number;
  maxDurationMinutes: number;
  approvalRequiredRoles: UserRole[];
  elevatableRoles: UserRole[];
}

export interface JitElevationRequestListResponseDto {
  total: number;
  requests: JitElevationRequestDto[];
}

export interface ActivePrivilegeListResponseDto {
  total: number;
  privileges: ActivePrivilegeDto[];
}
