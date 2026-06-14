import { createHmac, timingSafeEqual } from "node:crypto";

export const CSRF_HEADER_NAME = "X-CSRF-Token";

function getCsrfSecret(): string {
  return (
    process.env.CSRF_SECRET?.trim() ||
    process.env.SESSION_CSRF_SECRET?.trim() ||
    "dev-csrf-secret-change-in-production"
  );
}

export function createCsrfTokenForSession(sessionToken: string): string {
  return createHmac("sha256", getCsrfSecret()).update(sessionToken).digest("hex");
}

export function validateCsrfToken(
  sessionToken: string,
  providedToken: string,
): boolean {
  const expected = createCsrfTokenForSession(sessionToken);
  if (providedToken.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(providedToken), Buffer.from(expected));
}

export function getSessionTokenFromAuthHeader(
  headerValue?: string,
): string | null {
  if (!headerValue?.startsWith("Bearer ")) {
    return null;
  }

  const token = headerValue.slice("Bearer ".length).trim();
  return token || null;
}
