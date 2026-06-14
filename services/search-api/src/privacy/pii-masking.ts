import type { UserRole } from "@retailer-search/shared-types";

const PII_PRIVILEGED_STANDING_ROLES = new Set<UserRole>(["admin", "reviewer"]);

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function canViewUnmaskedPii(standingRole: UserRole | undefined): boolean {
  return standingRole !== undefined && PII_PRIVILEGED_STANDING_ROLES.has(standingRole);
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function maskEmailAddress(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) {
    return "***";
  }

  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex);
  if (localPart.length <= 1) {
    return `*${domain}`;
  }

  return `${localPart[0]}***${domain}`;
}

export function maskEmailsInText(text: string, preserveEmail?: string): string {
  const preserveLower = preserveEmail?.trim().toLowerCase();
  return text.replace(EMAIL_PATTERN, (match) => {
    if (preserveLower && match.toLowerCase() === preserveLower) {
      return match;
    }
    return maskEmailAddress(match);
  });
}
