import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNextSecurityHeaders,
  buildSecurityHeaders,
  REQUIRED_BROWSER_SECURITY_HEADER_NAMES,
} from "./security-headers.js";

describe("security headers", () => {
  it("includes all required browser security headers for web apps", () => {
    const headers = buildSecurityHeaders({
      mode: "web",
      includeHsts: true,
    });

    for (const name of REQUIRED_BROWSER_SECURITY_HEADER_NAMES) {
      assert.ok(headers[name], `missing header ${name}`);
    }
  });

  it("includes all required browser security headers for API responses", () => {
    const headers = buildSecurityHeaders({
      mode: "api",
      includeHsts: true,
    });

    for (const name of REQUIRED_BROWSER_SECURITY_HEADER_NAMES) {
      assert.ok(headers[name], `missing header ${name}`);
    }

    assert.match(headers["Content-Security-Policy"], /default-src 'none'/);
  });

  it("omits HSTS unless explicitly enabled", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousEnforceHttps = process.env.ENFORCE_HTTPS;
    process.env.NODE_ENV = "development";
    delete process.env.ENFORCE_HTTPS;

    const headers = buildSecurityHeaders({ mode: "web" });
    assert.equal(headers["Strict-Transport-Security"], undefined);

    process.env.NODE_ENV = previousNodeEnv;
    if (previousEnforceHttps === undefined) {
      delete process.env.ENFORCE_HTTPS;
    } else {
      process.env.ENFORCE_HTTPS = previousEnforceHttps;
    }
  });

  it("builds Next.js header entries", () => {
    const entries = buildNextSecurityHeaders({ includeHsts: true });
    assert.ok(entries.length >= 6);
    assert.ok(entries.some((entry) => entry.key === "Content-Security-Policy"));
  });
});
