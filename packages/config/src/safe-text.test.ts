import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  containsHtmlMarkup,
  safeJustificationSchema,
  safeRuleNameSchema,
  safeSearchQuerySchema,
  validateRuleName,
} from "./safe-text.js";

describe("safe text validation", () => {
  it("detects HTML markup payloads", () => {
    assert.equal(
      containsHtmlMarkup("<img src=x onerror=alert('StoredXSS')>"),
      true,
    );
    assert.equal(containsHtmlMarkup("boost drill queries"), false);
  });

  it("rejects HTML in rule names", () => {
    const parsed = safeRuleNameSchema.safeParse(
      "<img src=x onerror=alert('StoredXSS')>",
    );
    assert.equal(parsed.success, false);
  });

  it("accepts normal rule names", () => {
    const parsed = safeRuleNameSchema.safeParse("Boost cordless drills");
    assert.equal(parsed.success, true);
  });

  it("rejects HTML in search queries", () => {
    const parsed = safeSearchQuerySchema.safeParse("<script>alert(1)</script>");
    assert.equal(parsed.success, false);
  });

  it("rejects HTML in justifications", () => {
    const parsed = safeJustificationSchema.safeParse(
      "<b>Need access</b> for release window",
    );
    assert.equal(parsed.success, false);
  });

  it("exposes validateRuleName helper for clients", () => {
    const invalid = validateRuleName("<svg/onload=alert(1)>");
    assert.equal(invalid.ok, false);
    assert.match(invalid.error, /HTML|invalid/i);
  });
});
