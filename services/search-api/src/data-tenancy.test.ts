import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  AccessRequestDto,
  AccessReviewRunDto,
  ApprovalRequestDto,
  AuditLogEntryDto,
  JitElevationRequestDto,
  UserDto,
} from "@retailer-search/shared-types";
import {
  canViewAccessRequest,
  canViewAllGovernanceRecords,
  filterAccessRequestsForViewer,
  filterAccessReviewRunsForViewer,
  filterApprovalsForViewer,
  filterAuditLogsForViewer,
  filterJitElevationRequestsForViewer,
  sanitizeAccessReviewRunForViewer,
} from "./data-tenancy.js";

function createUser(role: UserDto["role"], id = "user-1"): UserDto {
  return {
    id,
    email: `${id}@example.com`,
    name: "Test User",
    role,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

describe("data tenancy", () => {
  it("treats admin and reviewer as governance-wide viewers", () => {
    assert.equal(canViewAllGovernanceRecords(createUser("admin")), true);
    assert.equal(canViewAllGovernanceRecords(createUser("reviewer")), true);
    assert.equal(canViewAllGovernanceRecords(createUser("merchandiser")), false);
  });

  it("scopes access requests to the requester unless privileged", () => {
    const viewer = createUser("merchandiser", "user-a");
    const requests: AccessRequestDto[] = [
      {
        id: "req-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requesterUserId: "user-a",
        requesterEmail: "user-a@example.com",
        requesterName: "User A",
        requestedRole: "reviewer",
        justification: "Need reviewer access",
        status: "pending",
      },
      {
        id: "req-2",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requesterUserId: "user-b",
        requesterEmail: "user-b@example.com",
        requesterName: "User B",
        requestedRole: "approver",
        justification: "Need approver access",
        status: "pending",
      },
    ];

    const scoped = filterAccessRequestsForViewer(requests, viewer);
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0]?.id, "req-1");
    assert.equal(canViewAccessRequest(requests[1]!, viewer), false);
  });

  it("scopes JIT requests to the requester unless privileged", () => {
    const viewer = createUser("developer", "user-a");
    const requests: JitElevationRequestDto[] = [
      {
        id: "jit-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requesterUserId: "user-a",
        requesterEmail: "user-a@example.com",
        requesterName: "User A",
        requestedRole: "reviewer",
        requestedDurationMinutes: 30,
        justification: "Temporary review access",
        status: "pending",
      },
      {
        id: "jit-2",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requesterUserId: "user-b",
        requesterEmail: "user-b@example.com",
        requesterName: "User B",
        requestedRole: "admin",
        requestedDurationMinutes: 30,
        justification: "Temporary admin access",
        status: "pending",
      },
    ];

    const scoped = filterJitElevationRequestsForViewer(requests, viewer);
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0]?.id, "jit-1");
  });

  it("redacts other users from access review runs", () => {
    const viewer = createUser("merchandiser", "user-a");
    const run: AccessReviewRunDto = {
      id: "review-1",
      createdAt: new Date().toISOString(),
      createdByUserId: "admin-1",
      createdByName: "Admin",
      status: "open",
      scope: { roles: ["merchandiser", "reviewer"] },
      summary: {
        totalUsers: 2,
        adminsReviewed: 0,
        inactiveUsersFlagged: 1,
      },
      items: [
        {
          userId: "user-a",
          userEmail: "user-a@example.com",
          userName: "User A",
          currentRole: "merchandiser",
          active: true,
          lastLoginAt: "2026-02-16T10:00:00.000Z",
        },
        {
          userId: "user-b",
          userEmail: "user-b@example.com",
          userName: "User B",
          currentRole: "reviewer",
          active: true,
          lastLoginAt: "2026-02-15T10:00:00.000Z",
        },
      ],
    };

    const sanitized = sanitizeAccessReviewRunForViewer(run, viewer);
    assert.ok(sanitized);
    assert.equal(sanitized?.items.length, 1);
    assert.equal(sanitized?.items[0]?.userId, "user-a");
    assert.equal(sanitized?.summary, undefined);

    const runs = filterAccessReviewRunsForViewer([run], viewer);
    assert.equal(runs.length, 1);
    assert.equal(runs[0]?.items.length, 1);
  });

  it("limits audit logs to the viewer unless audit permission is granted", () => {
    const viewer = createUser("merchandiser", "user-a");
    const entries: AuditLogEntryDto[] = [
      {
        id: "audit-1",
        timestamp: new Date().toISOString(),
        actorId: "user-a",
        actorLabel: "user-a@example.com",
        actionType: "create_jit_elevation_request",
        entityType: "jit_elevation_request",
        outcome: "success",
        summary: "User user-a@example.com requested temporary role reviewer",
      },
      {
        id: "audit-2",
        timestamp: new Date().toISOString(),
        actorId: "user-b",
        actorLabel: "user-b@example.com",
        actionType: "user_login",
        entityType: "user",
        entityId: "user-b",
        outcome: "success",
        summary: "User user-b@example.com logged in",
      },
    ];

    const scoped = filterAuditLogsForViewer(entries, viewer, "merchandiser");
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0]?.id, "audit-1");
  });

  it("limits approvals to requester unless approval permission is granted", () => {
    const viewer = createUser("merchandiser", "user-a");
    const requests: ApprovalRequestDto[] = [
      {
        id: "appr-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "pending",
        sourceEnvironment: "staging",
        targetEnvironment: "live",
        requestedBy: { actorId: "user-a", actorLabel: "User A" },
        reason: "Promote snapshot",
      },
      {
        id: "appr-2",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "pending",
        sourceEnvironment: "staging",
        targetEnvironment: "live",
        requestedBy: { actorId: "user-b", actorLabel: "User B" },
        reason: "Promote other snapshot",
      },
    ];

    const scoped = filterApprovalsForViewer(requests, viewer, "merchandiser");
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0]?.id, "appr-1");
  });
});
