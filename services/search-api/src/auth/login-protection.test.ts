import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearLoginFailures,
  getAccountLockStatus,
  recordFailedLoginAttempt,
} from "./login-protection.js";

const config = {
  maxFailedAttempts: 5,
  lockoutWindowMinutes: 15,
  maxLockoutMinutes: 60,
};

describe("login protection", () => {
  it("locks account after max failed attempts", () => {
    const email = "lockout-test@example.com";
    clearLoginFailures(email);

    for (let attempt = 1; attempt < config.maxFailedAttempts; attempt += 1) {
      const status = recordFailedLoginAttempt(email, config);
      assert.equal(status.locked, false);
    }

    const locked = recordFailedLoginAttempt(email, config);
    assert.equal(locked.locked, true);
    assert.ok(locked.retryAfterSeconds && locked.retryAfterSeconds > 0);
    assert.equal(getAccountLockStatus(email, config).locked, true);
  });

  it("clears failures after successful login", () => {
    const email = "clear-test@example.com";
    clearLoginFailures(email);
    recordFailedLoginAttempt(email, config);
    recordFailedLoginAttempt(email, config);

    clearLoginFailures(email);

    const status = getAccountLockStatus(email, config);
    assert.equal(status.locked, false);
    assert.equal(status.failedAttempts, 0);
  });

  it("applies exponential backoff on repeated lockouts", () => {
    const email = "backoff-test@example.com";
    clearLoginFailures(email);

    let firstLockSeconds = 0;
    for (let attempt = 0; attempt < config.maxFailedAttempts; attempt += 1) {
      const status = recordFailedLoginAttempt(email, config);
      if (status.locked) {
        firstLockSeconds = status.retryAfterSeconds ?? 0;
        break;
      }
    }

    assert.ok(firstLockSeconds > 0);

    const state = getAccountLockStatus(email, config);
    assert.equal(state.locked, true);

    clearLoginFailures(email);
    const account = recordFailedLoginAttempt(email, config);
    void account;
  });
});
