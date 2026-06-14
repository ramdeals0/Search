import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request, Response } from "express";
import {
  createCsrfTokenForSession,
  validateCsrfToken,
} from "./csrf-token.js";
import { enforceCsrfProtection } from "./csrf-protection.js";

describe("CSRF protection", () => {
  it("derives stable CSRF tokens from session tokens", () => {
    const token = "session-token-abc123";
    const csrf = createCsrfTokenForSession(token);
    assert.equal(csrf, createCsrfTokenForSession(token));
    assert.ok(validateCsrfToken(token, csrf));
  });

  it("rejects invalid CSRF tokens", () => {
    assert.equal(validateCsrfToken("session-token", "bad-token"), false);
  });

  it("allows safe methods without CSRF headers", () => {
    let called = false;
    const req = {
      method: "GET",
      path: "/api/v1/admin/rules",
      header: () => undefined,
    } as unknown as Request;
    const res = {} as Response;

    enforceCsrfProtection(req, res, () => {
      called = true;
    });

    assert.equal(called, true);
  });

  it("skips CSRF enforcement for login endpoint", () => {
    let called = false;
    const req = {
      method: "POST",
      path: "/api/v1/auth/login",
      header: () => undefined,
    } as unknown as Request;
    const res = {} as Response;

    enforceCsrfProtection(req, res, () => {
      called = true;
    });

    assert.equal(called, true);
  });
});
