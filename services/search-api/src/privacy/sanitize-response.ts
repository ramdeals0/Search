import type { UserRole } from "@retailer-search/shared-types";
import {
  canViewUnmaskedPii,
  looksLikeEmail,
  maskEmailAddress,
  maskEmailsInText,
} from "./pii-masking.js";

export interface PiiSanitizationContext {
  standingRole?: UserRole;
  viewerEmail?: string;
}

const EMAIL_FIELD_NAMES = new Set([
  "email",
  "requesterEmail",
  "userEmail",
  "initializedByEmail",
  "firstAdminEmail",
  "requestedByActorLabel",
  "approvedByActorLabel",
  "rejectedByActorLabel",
  "executedByActorLabel",
]);

const TEXT_FIELDS_WITH_EMBEDDED_EMAILS = new Set([
  "summary",
  "message",
  "justification",
  "reviewerNote",
  "note",
  "errorMessage",
]);

function shouldPreserveEmail(email: string, viewerEmailLower?: string): boolean {
  return Boolean(
    viewerEmailLower && email.trim().toLowerCase() === viewerEmailLower,
  );
}

function sanitizeEmailField(email: string, viewerEmailLower?: string): string {
  if (shouldPreserveEmail(email, viewerEmailLower)) {
    return email;
  }
  return maskEmailAddress(email);
}

function sanitizeStringField(
  key: string,
  value: string,
  viewerEmail?: string,
): string {
  const viewerEmailLower = viewerEmail?.trim().toLowerCase();

  if (
    EMAIL_FIELD_NAMES.has(key) ||
    (key === "actorLabel" && looksLikeEmail(value))
  ) {
    return sanitizeEmailField(value, viewerEmailLower);
  }

  if (TEXT_FIELDS_WITH_EMBEDDED_EMAILS.has(key)) {
    return maskEmailsInText(value, viewerEmail);
  }

  if (looksLikeEmail(value)) {
    return sanitizeEmailField(value, viewerEmailLower);
  }

  return value;
}

function sanitizeValue(value: unknown, viewerEmail?: string): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return maskEmailsInText(value, viewerEmail);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, viewerEmail));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (typeof entry === "string") {
        result[key] = sanitizeStringField(key, entry, viewerEmail);
      } else {
        result[key] = sanitizeValue(entry, viewerEmail);
      }
    }
    return result;
  }

  return value;
}

export function sanitizeResponseForViewer<T>(
  value: T,
  context: PiiSanitizationContext,
): T {
  if (canViewUnmaskedPii(context.standingRole)) {
    return value;
  }

  return sanitizeValue(value, context.viewerEmail) as T;
}

export function sanitizeExportContent(
  content: string,
  format: "json" | "csv",
  context: PiiSanitizationContext,
): string {
  if (canViewUnmaskedPii(context.standingRole)) {
    return content;
  }

  if (format === "json") {
    try {
      const parsed = JSON.parse(content) as unknown;
      return JSON.stringify(sanitizeValue(parsed, context.viewerEmail), null, 2);
    } catch {
      return maskEmailsInText(content, context.viewerEmail);
    }
  }

  return maskEmailsInText(content, context.viewerEmail);
}
