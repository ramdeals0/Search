import type { Express, Request, Response } from "express";
import type {
  AccessRequestListResponseDto,
  AccessReviewListResponseDto,
  ActivePrivilegeListResponseDto,
  JitElevationRequestListResponseDto,
  JitPolicyDto,
  UserDto,
} from "@retailer-search/shared-types";
import { z } from "zod";
import {
  completeAccessReviewRun,
  createAccessRequest,
  createAccessReviewRun,
  getAccessRequestById,
  getAccessReviewRunById,
  listAccessRequests,
  listAccessReviewRuns,
  resolveAccessRequest,
  resolveAccessReviewItem,
} from "../access-governance/access-governance-store.js";
import {
  createJitElevationRequest,
  getActivePrivileges,
  getJitElevationRequestById,
  getJitPolicy,
  listJitElevationRequests,
  resolveJitElevationRequest,
  revokeJitAccess,
  updateJitPolicy,
} from "../access-governance/jit-access-store.js";
import { recordAuditLog } from "../audit-trail-store.js";
import { listUsers } from "../auth-store.js";

const userRoleSchema = z.enum([
  "merchandiser",
  "reviewer",
  "approver",
  "release_manager",
  "admin",
]);

const createAccessRequestSchema = z.object({
  requestedRole: userRoleSchema,
  justification: z.string().min(8),
});

const resolveAccessRequestSchema = z.object({
  decision: z.enum(["approved", "denied", "cancelled"]),
  reviewerNote: z.string().optional(),
});

const createAccessReviewRunSchema = z.object({
  roles: z.array(userRoleSchema).optional(),
});

const resolveAccessReviewItemSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["keep", "downgrade", "disable"]),
  note: z.string().optional(),
});

const createJitElevationRequestSchema = z.object({
  requestedRole: userRoleSchema,
  justification: z.string().min(8),
  requestedDurationMinutes: z.coerce.number().int().positive(),
});

const resolveJitElevationRequestSchema = z.object({
  decision: z.enum(["approve", "deny", "cancel"]),
  reviewerNote: z.string().optional(),
});

const updateJitPolicySchema = z.object({
  enabled: z.boolean(),
  defaultDurationMinutes: z.coerce.number().int().positive(),
  maxDurationMinutes: z.coerce.number().int().positive(),
  approvalRequiredRoles: z.array(userRoleSchema),
  elevatableRoles: z.array(userRoleSchema).min(1),
});

export interface AccessGovernanceRouteDeps {
  requireAuthenticatedUser: (
    req: Request,
    res: Response,
  ) => UserDto | null;
  requireAdminUser: (req: Request, res: Response) => UserDto | null;
  assertValidBody: <T>(
    parsed: { success: true; data: T } | { success: false; error: z.ZodError },
    res: Response,
    req: Request,
    message: string,
  ) => parsed is { success: true; data: T };
  syncJitAccess: () => void;
  dispatchWebhookEvent: (
    type: import("@retailer-search/shared-types").WebhookEventType,
    payload: Record<string, unknown>,
    actorId?: string,
    actorLabel?: string,
  ) => void;
}

export function registerAccessGovernanceRoutes(
  app: Express,
  deps: AccessGovernanceRouteDeps,
): void {
  const {
    requireAuthenticatedUser,
    requireAdminUser,
    assertValidBody,
    syncJitAccess,
    dispatchWebhookEvent,
  } = deps;

app.get("/api/v1/admin/access-requests", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const allRequests = listAccessRequests();
  const requests =
    user.role === "admin"
      ? allRequests.requests
      : allRequests.requests.filter(
          (request) => request.requesterUserId === user.id,
        );

  const body: AccessRequestListResponseDto = {
    total: requests.length,
    requests,
  };
  res.json(body);
});

app.post("/api/v1/admin/access-requests", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const parsed = createAccessRequestSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid access request payload")) {
    return;
  }

  const result = createAccessRequest(user, parsed.data);
  if (!result.success || !result.request) {
    recordAuditLog({
      actionType: "create_access_request",
      entityType: "access_request",
      outcome: "failure",
      actorId: user.id,
      actorLabel: user.email,
      summary: `Failed access request from ${user.email}`,
      metadata: { error: result.error },
    });
    res.status(400).json({ error: result.error ?? "Failed to create access request" });
    return;
  }

  recordAuditLog({
    actionType: "create_access_request",
    entityType: "access_request",
    entityId: result.request.id,
    actorId: user.id,
    actorLabel: user.email,
    outcome: "success",
    summary: `User ${user.email} requested role ${result.request.requestedRole}`,
    metadata: {
      requestedRole: result.request.requestedRole,
      justification: result.request.justification,
    },
  });

  res.status(201).json(result.request);
});

app.post("/api/v1/admin/access-requests/:id/resolve", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const parsed = resolveAccessRequestSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid access request resolution payload")) {
    return;
  }

  const existing = getAccessRequestById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Access request not found" });
    return;
  }

  const result = resolveAccessRequest(
    req.params.id,
    parsed.data.decision,
    user,
    parsed.data.reviewerNote,
  );

  if (!result.success || !result.request) {
    recordAuditLog({
      actionType: "resolve_access_request",
      entityType: "access_request",
      entityId: req.params.id,
      actorId: user.id,
      actorLabel: user.email,
      outcome: "failure",
      summary: `Failed to ${parsed.data.decision} access request ${req.params.id}`,
      metadata: { error: result.error, decision: parsed.data.decision },
    });
    res.status(400).json({ error: result.error ?? "Failed to resolve access request" });
    return;
  }

  recordAuditLog({
    actionType: "resolve_access_request",
    entityType: "access_request",
    entityId: result.request.id,
    actorId: user.id,
    actorLabel: user.email,
    outcome: "success",
    summary:
      parsed.data.decision === "approved"
        ? `Admin approved access request ${result.request.id} for role ${result.request.requestedRole}`
        : parsed.data.decision === "denied"
          ? `Admin denied access request ${result.request.id}`
          : `Access request ${result.request.id} cancelled`,
    metadata: {
      decision: parsed.data.decision,
      reviewerNote: parsed.data.reviewerNote,
      requestedRole: result.request.requestedRole,
    },
  });

  if (parsed.data.decision === "approved") {
    recordAuditLog({
      actionType: "update_user_role",
      entityType: "user",
      entityId: result.request.requesterUserId,
      actorId: user.id,
      actorLabel: user.email,
      outcome: "success",
      summary: `Updated ${result.request.requesterEmail} role to ${result.request.requestedRole}`,
      metadata: {
        requestedRole: result.request.requestedRole,
        accessRequestId: result.request.id,
      },
    });
  }

  res.json(result.request);
});

app.get("/api/v1/admin/access-reviews", (req, res) => {
  const user = requireAdminUser(req, res);
  if (!user) {
    return;
  }

  const body: AccessReviewListResponseDto = listAccessReviewRuns();
  res.json(body);
});

app.post("/api/v1/admin/access-reviews", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const parsed = createAccessReviewRunSchema.safeParse(req.body ?? {});
  if (!assertValidBody(parsed, res, req, "Invalid access review payload")) {
    return;
  }

  const users = listUsers().users;
  const run = createAccessReviewRun(admin, users, parsed.data.roles);

  const scopeLabel =
    run.scope.roles.length === 5
      ? "all roles"
      : run.scope.roles.join(", ");

  recordAuditLog({
    actionType: "create_access_review",
    entityType: "access_review",
    entityId: run.id,
    actorId: admin.id,
    actorLabel: admin.email,
    outcome: "success",
    summary: `Started access review run for roles ${scopeLabel}`,
    metadata: {
      roles: run.scope.roles,
      totalUsers: run.items.length,
    },
  });

  res.status(201).json(run);
});

app.get("/api/v1/admin/access-reviews/:id", (req, res) => {
  const user = requireAdminUser(req, res);
  if (!user) {
    return;
  }

  const run = getAccessReviewRunById(req.params.id);
  if (!run) {
    res.status(404).json({ error: "Access review run not found" });
    return;
  }

  res.json(run);
});

app.post("/api/v1/admin/access-reviews/:id/items/resolve", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const parsed = resolveAccessReviewItemSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid access review item payload")) {
    return;
  }

  const result = resolveAccessReviewItem(
    req.params.id,
    parsed.data.userId,
    parsed.data.action,
    parsed.data.note,
  );

  if (!result.success || !result.run) {
    recordAuditLog({
      actionType: "resolve_access_review_item",
      entityType: "access_review",
      entityId: req.params.id,
      actorId: admin.id,
      actorLabel: admin.email,
      outcome: "failure",
      summary: `Failed access review item action for user ${parsed.data.userId}`,
      metadata: { error: result.error, action: parsed.data.action },
    });
    res.status(400).json({ error: result.error ?? "Failed to resolve review item" });
    return;
  }

  const item = result.run.items.find((entry) => entry.userId === parsed.data.userId);
  const itemEmail = item?.userEmail ?? parsed.data.userId;

  recordAuditLog({
    actionType: "resolve_access_review_item",
    entityType: "access_review",
    entityId: req.params.id,
    actorId: admin.id,
    actorLabel: admin.email,
    outcome: "success",
    summary:
      parsed.data.action === "disable"
        ? `Disabled inactive user ${itemEmail} during access review`
        : parsed.data.action === "downgrade"
          ? `Downgraded ${itemEmail} from ${result.previousRole} to ${result.nextRole} during access review`
          : `Kept access for ${itemEmail} during access review`,
    metadata: {
      userId: parsed.data.userId,
      action: parsed.data.action,
      note: parsed.data.note,
      previousRole: result.previousRole,
      nextRole: result.nextRole,
    },
  });

  if (parsed.data.action === "disable") {
    recordAuditLog({
      actionType: "disable_user",
      entityType: "user",
      entityId: parsed.data.userId,
      actorId: admin.id,
      actorLabel: admin.email,
      outcome: "success",
      summary: `Disabled user ${itemEmail} during access review`,
      metadata: { accessReviewRunId: req.params.id },
    });
  } else if (
    parsed.data.action === "downgrade" &&
    result.previousRole &&
    result.nextRole &&
    result.previousRole !== result.nextRole
  ) {
    recordAuditLog({
      actionType: "update_user_role",
      entityType: "user",
      entityId: parsed.data.userId,
      actorId: admin.id,
      actorLabel: admin.email,
      outcome: "success",
      summary: `Updated ${itemEmail} role to ${result.nextRole} during access review`,
      metadata: {
        previousRole: result.previousRole,
        nextRole: result.nextRole,
        accessReviewRunId: req.params.id,
      },
    });
  }

  res.json(result.run);
});

app.post("/api/v1/admin/access-reviews/:id/complete", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const result = completeAccessReviewRun(req.params.id);
  if (!result.success || !result.run) {
    recordAuditLog({
      actionType: "complete_access_review",
      entityType: "access_review",
      entityId: req.params.id,
      actorId: admin.id,
      actorLabel: admin.email,
      outcome: "failure",
      summary: `Failed to complete access review ${req.params.id}`,
      metadata: { error: result.error },
    });
    res.status(400).json({ error: result.error ?? "Failed to complete access review" });
    return;
  }

  recordAuditLog({
    actionType: "complete_access_review",
    entityType: "access_review",
    entityId: result.run.id,
    actorId: admin.id,
    actorLabel: admin.email,
    outcome: "success",
    summary: `Completed access review run ${result.run.id}`,
    metadata: result.run.summary,
  });
  void dispatchWebhookEvent(
    "audit.review.completed",
    {
      reviewRunId: result.run.id,
      totalUsers: result.run.summary?.totalUsers,
      createdByName: result.run.createdByName,
    },
    admin.id,
    admin.email,
  );

  res.json(result.run);
});

app.get("/api/v1/admin/jit-policy", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const body: JitPolicyDto = getJitPolicy();
  res.json(body);
});

app.post("/api/v1/admin/jit-policy", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const parsed = updateJitPolicySchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid JIT policy payload")) {
    return;
  }

  try {
    const policy = updateJitPolicy(parsed.data);
    recordAuditLog({
      actionType: "update_jit_policy",
      entityType: "jit_policy",
      entityId: "default",
      actorId: admin.id,
      actorLabel: admin.email,
      outcome: "success",
      summary: "Updated JIT elevation policy",
      metadata: { ...policy },
    });
    res.json(policy);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to update JIT policy",
    });
  }
});

app.get("/api/v1/admin/jit-requests", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const allRequests = listJitElevationRequests();
  const requests =
    user.role === "admin"
      ? allRequests.requests
      : allRequests.requests.filter(
          (request) => request.requesterUserId === user.id,
        );

  const body: JitElevationRequestListResponseDto = {
    total: requests.length,
    requests,
  };
  res.json(body);
});

app.post("/api/v1/admin/jit-requests", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const parsed = createJitElevationRequestSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid JIT elevation request payload")) {
    return;
  }

  const result = createJitElevationRequest(parsed.data, user);
  if (!result.success || !result.request) {
    recordAuditLog({
      actionType: "create_jit_elevation_request",
      entityType: "jit_elevation_request",
      outcome: "failure",
      actorId: user.id,
      actorLabel: user.email,
      summary: `Failed JIT elevation request from ${user.email}`,
      metadata: { error: result.error },
    });
    res.status(400).json({ error: result.error ?? "Failed to create JIT elevation request" });
    return;
  }

  recordAuditLog({
    actionType: "create_jit_elevation_request",
    entityType: "jit_elevation_request",
    entityId: result.request.id,
    actorId: user.id,
    actorLabel: user.email,
    outcome: "success",
    summary: `User ${user.email} requested temporary role ${result.request.requestedRole} for ${result.request.requestedDurationMinutes} minutes`,
    metadata: {
      requestedRole: result.request.requestedRole,
      requestedDurationMinutes: result.request.requestedDurationMinutes,
      status: result.request.status,
      justification: result.request.justification,
    },
  });

  if (result.request.status === "active") {
    recordAuditLog({
      actionType: "resolve_jit_elevation_request",
      entityType: "jit_elevation_request",
      entityId: result.request.id,
      actorId: user.id,
      actorLabel: user.email,
      outcome: "success",
      summary: `JIT elevation ${result.request.id} auto-activated for ${user.email}`,
      metadata: {
        requestedRole: result.request.requestedRole,
        expiresAt: result.request.expiresAt,
      },
    });
    void dispatchWebhookEvent(
      "jit.request.approved",
      {
        requestId: result.request.id,
        requesterEmail: result.request.requesterEmail,
        requestedRole: result.request.requestedRole,
        expiresAt: result.request.expiresAt,
        autoActivated: true,
      },
      user.id,
      user.email,
    );
  }

  res.status(201).json(result.request);
});

app.post("/api/v1/admin/jit-requests/:id/resolve", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const parsed = resolveJitElevationRequestSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid JIT elevation resolution payload")) {
    return;
  }

  const existing = getJitElevationRequestById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "JIT elevation request not found" });
    return;
  }

  const result = resolveJitElevationRequest(
    req.params.id,
    parsed.data.decision,
    user,
    parsed.data.reviewerNote,
  );

  if (!result.success || !result.request) {
    recordAuditLog({
      actionType: "resolve_jit_elevation_request",
      entityType: "jit_elevation_request",
      entityId: req.params.id,
      actorId: user.id,
      actorLabel: user.email,
      outcome: "failure",
      summary: `Failed to ${parsed.data.decision} JIT elevation ${req.params.id}`,
      metadata: { error: result.error, decision: parsed.data.decision },
    });
    res.status(400).json({ error: result.error ?? "Failed to resolve JIT elevation request" });
    return;
  }

  const decisionSummary: Record<string, string> = {
    approve: `Admin approved JIT elevation ${result.request.id} for ${result.request.requesterEmail}`,
    deny: `Admin denied JIT elevation ${result.request.id} for ${result.request.requesterEmail}`,
    cancel: `JIT elevation ${result.request.id} cancelled`,
  };

  recordAuditLog({
    actionType: "resolve_jit_elevation_request",
    entityType: "jit_elevation_request",
    entityId: result.request.id,
    actorId: user.id,
    actorLabel: user.email,
    outcome: "success",
    summary: decisionSummary[parsed.data.decision],
    metadata: {
      decision: parsed.data.decision,
      reviewerNote: parsed.data.reviewerNote,
      requestedRole: result.request.requestedRole,
      expiresAt: result.request.expiresAt,
    },
  });

  if (parsed.data.decision === "approve" && result.request.status === "active") {
    void dispatchWebhookEvent(
      "jit.request.approved",
      {
        requestId: result.request.id,
        requesterEmail: result.request.requesterEmail,
        requestedRole: result.request.requestedRole,
        expiresAt: result.request.expiresAt,
      },
      user.id,
      user.email,
    );
  }

  res.json(result.request);
});

app.post("/api/v1/admin/jit-requests/:id/revoke", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const existing = getJitElevationRequestById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "JIT elevation request not found" });
    return;
  }

  const result = revokeJitAccess(req.params.id, admin);
  if (!result.success || !result.request) {
    recordAuditLog({
      actionType: "revoke_jit_elevation",
      entityType: "jit_elevation_request",
      entityId: req.params.id,
      actorId: admin.id,
      actorLabel: admin.email,
      outcome: "failure",
      summary: `Failed to revoke JIT elevation ${req.params.id}`,
      metadata: { error: result.error },
    });
    res.status(400).json({ error: result.error ?? "Failed to revoke JIT elevation" });
    return;
  }

  recordAuditLog({
    actionType: "revoke_jit_elevation",
    entityType: "jit_elevation_request",
    entityId: result.request.id,
    actorId: admin.id,
    actorLabel: admin.email,
    outcome: "success",
    summary: `Admin revoked active JIT elevation ${result.request.id}`,
    metadata: {
      requesterEmail: result.request.requesterEmail,
      requestedRole: result.request.requestedRole,
    },
  });
  void dispatchWebhookEvent(
    "jit.request.revoked",
    {
      requestId: result.request.id,
      requesterEmail: result.request.requesterEmail,
      requestedRole: result.request.requestedRole,
    },
    admin.id,
    admin.email,
  );

  res.json(result.request);
});

app.get("/api/v1/admin/active-privileges", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  syncJitAccess();
  const privileges = getActivePrivileges();

  const body: ActivePrivilegeListResponseDto = {
    total: privileges.length,
    privileges:
      user.role === "admin"
        ? privileges
        : privileges.filter((privilege) => privilege.userId === user.id),
  };
  res.json(body);
});
}
