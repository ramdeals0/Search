import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeSessionTiming,
  defaultSessionPolicyConfig,
} from "./session-policy.js";

describe("session policy", () => {
  it("defaults to 8 hour absolute and 30 minute inactivity timeouts", () => {
    const previousTtl = process.env.SESSION_TTL_HOURS;
    const previousInactivity = process.env.SESSION_INACTIVITY_MINUTES;
    delete process.env.SESSION_TTL_HOURS;
    delete process.env.SESSION_INACTIVITY_MINUTES;

    const policy = defaultSessionPolicyConfig();
    assert.equal(policy.absoluteTtlHours, 8);
    assert.equal(policy.inactivityMinutes, 30);

    if (previousTtl === undefined) {
      delete process.env.SESSION_TTL_HOURS;
    } else {
      process.env.SESSION_TTL_HOURS = previousTtl;
    }
    if (previousInactivity === undefined) {
      delete process.env.SESSION_INACTIVITY_MINUTES;
    } else {
      process.env.SESSION_INACTIVITY_MINUTES = previousInactivity;
    }
  });

  it("expires sessions after inactivity window", () => {
    const createdAt = new Date("2026-06-10T10:00:00.000Z");
    const lastActivityAt = new Date("2026-06-10T10:00:00.000Z");
    const timing = computeSessionTiming(
      createdAt,
      lastActivityAt,
      { absoluteTtlHours: 8, inactivityMinutes: 30, warningMinutes: 5 },
      new Date("2026-06-10T10:31:00.000Z"),
    );

    assert.equal(timing.reason, "inactivity");
  });

  it("expires sessions after absolute lifetime", () => {
    const createdAt = new Date("2026-06-10T10:00:00.000Z");
    const lastActivityAt = new Date("2026-06-10T17:30:00.000Z");
    const timing = computeSessionTiming(
      createdAt,
      lastActivityAt,
      { absoluteTtlHours: 8, inactivityMinutes: 30, warningMinutes: 5 },
      new Date("2026-06-10T18:01:00.000Z"),
    );

    assert.equal(timing.reason, "absolute");
  });
});
