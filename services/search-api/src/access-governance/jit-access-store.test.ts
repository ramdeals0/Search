import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UserDto } from "@retailer-search/shared-types";
import {
  createJitElevationRequest,
  getEffectiveRoleForUser,
  getJitPolicy,
  resolveJitElevationRequest,
  updateJitPolicy,
} from "./jit-access-store.js";

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

describe("JIT access store", () => {
  it("keeps elevation requests pending until an admin approves them", () => {
    const merchandiser = createUser("merchandiser");
    const result = createJitElevationRequest(
      {
        requestedRole: "reviewer",
        justification: "Need to review pending approvals",
        requestedDurationMinutes: 30,
      },
      merchandiser,
      new Date("2026-06-10T12:00:00.000Z"),
    );

    assert.equal(result.success, true);
    assert.equal(result.request?.status, "pending");
    assert.equal(getEffectiveRoleForUser(merchandiser), "merchandiser");
  });

  it("activates elevation only after admin approval", () => {
    const merchandiser = createUser("merchandiser", "merch-2");
    const admin = createUser("admin", "admin-1");
    const now = new Date("2026-06-10T12:05:00.000Z");
    const created = createJitElevationRequest(
      {
        requestedRole: "approver",
        justification: "Cover approver shift today",
        requestedDurationMinutes: 45,
      },
      merchandiser,
      new Date("2026-06-10T12:00:00.000Z"),
    );

    assert.equal(created.success, true);
    assert.ok(created.request);

    const resolved = resolveJitElevationRequest(
      created.request!.id,
      "approve",
      admin,
      "Approved for shift coverage",
      now,
    );

    assert.equal(resolved.success, true);
    assert.equal(resolved.request?.status, "active");
    assert.equal(getEffectiveRoleForUser(merchandiser, now), "approver");
  });

  it("requires approval policy coverage for every elevatable role", () => {
    assert.throws(
      () =>
        updateJitPolicy({
          enabled: true,
          defaultDurationMinutes: 30,
          maxDurationMinutes: 120,
          elevatableRoles: ["reviewer", "approver", "release_manager", "admin"],
          approvalRequiredRoles: ["admin"],
        }),
      /Approval is required for all elevatable roles/,
    );
  });

  it("defaults to requiring approval for all elevatable roles", () => {
    const policy = getJitPolicy();
    assert.deepEqual(policy.approvalRequiredRoles.sort(), [
      "admin",
      "approver",
      "release_manager",
      "reviewer",
    ]);
  });
});
