import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canViewUnmaskedPii,
  maskEmailAddress,
  maskEmailsInText,
} from "./pii-masking.js";
import {
  sanitizeExportContent,
  sanitizeResponseForViewer,
} from "./sanitize-response.js";

describe("PII masking", () => {
  it("allows admin and reviewer standing roles to view unmasked PII", () => {
    assert.equal(canViewUnmaskedPii("admin"), true);
    assert.equal(canViewUnmaskedPii("reviewer"), true);
    assert.equal(canViewUnmaskedPii("merchandiser"), false);
    assert.equal(canViewUnmaskedPii("approver"), false);
    assert.equal(canViewUnmaskedPii(undefined), false);
  });

  it("masks email local parts while preserving domain", () => {
    assert.equal(maskEmailAddress("admin@example.com"), "a***@example.com");
    assert.equal(maskEmailAddress("a@example.com"), "*@example.com");
  });

  it("masks embedded emails in summary text", () => {
    const masked = maskEmailsInText(
      "User admin@example.com requested role reviewer",
    );
    assert.equal(masked, "User a***@example.com requested role reviewer");
  });

  it("preserves the viewer email in free text", () => {
    const masked = maskEmailsInText(
      "User admin@example.com copied merch@example.com",
      "merch@example.com",
    );
    assert.equal(
      masked,
      "User a***@example.com copied merch@example.com",
    );
  });

  it("sanitizes nested admin API payloads for non-privileged roles", () => {
    const sanitized = sanitizeResponseForViewer(
      {
        entries: [
          {
            actorLabel: "admin@example.com",
            summary: "User merch@example.com exported audit_trail",
            requesterEmail: "merch@example.com",
          },
        ],
      },
      { standingRole: "merchandiser", viewerEmail: "merch@example.com" },
    );

    assert.deepEqual(sanitized, {
      entries: [
        {
          actorLabel: "a***@example.com",
          summary: "User merch@example.com exported audit_trail",
          requesterEmail: "merch@example.com",
        },
      ],
    });
  });

  it("leaves responses unchanged for reviewer standing role", () => {
    const payload = {
      userEmail: "admin@example.com",
      summary: "User admin@example.com updated access",
    };
    const sanitized = sanitizeResponseForViewer(payload, {
      standingRole: "reviewer",
      viewerEmail: "reviewer@example.com",
    });
    assert.deepEqual(sanitized, payload);
  });

  it("sanitizes JSON export downloads", () => {
    const content = JSON.stringify([
      { actorLabel: "admin@example.com", summary: "login for admin@example.com" },
    ]);
    const sanitized = sanitizeExportContent(content, "json", {
      standingRole: "developer",
      viewerEmail: "dev@example.com",
    });

    assert.deepEqual(JSON.parse(sanitized), [
      {
        actorLabel: "a***@example.com",
        summary: "login for a***@example.com",
      },
    ]);
  });

  it("masks bootstrap setup emails for unauthenticated callers", () => {
    const sanitized = sanitizeResponseForViewer(
      {
        initializedByEmail: "admin@example.com",
        firstAdminEmail: "admin@example.com",
      },
      {},
    );

    assert.deepEqual(sanitized, {
      initializedByEmail: "a***@example.com",
      firstAdminEmail: "a***@example.com",
    });
  });
});
