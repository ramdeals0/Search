import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  safeJustificationSchema,
  safeRuleNameSchema,
  safeSearchQuerySchema,
} from "@retailer-search/config/safe-text";

const XSS_RULE_NAME = "<img src=x onerror=alert('StoredXSS')>";

describe("admin input safe text validation", () => {
  it("rejects HTML payloads in merchandising rule names", () => {
    const parsed = safeRuleNameSchema.safeParse(XSS_RULE_NAME);
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.match(parsed.error.issues[0]?.message ?? "", /HTML|invalid/i);
    }
  });

  it("rejects HTML in rule condition queries", () => {
    const parsed = safeSearchQuerySchema.safeParse("<script>alert(1)</script>");
    assert.equal(parsed.success, false);
  });

  it("rejects HTML in access justifications", () => {
    const parsed = safeJustificationSchema.safeParse(
      "<img src=x onerror=alert(1)> need reviewer access",
    );
    assert.equal(parsed.success, false);
  });

  it("accepts a valid merchandising rule payload shape", () => {
    const parsed = safeRuleNameSchema.safeParse("Boost cordless drills");
    assert.equal(parsed.success, true);
  });
});
