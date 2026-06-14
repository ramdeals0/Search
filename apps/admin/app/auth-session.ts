export const AUTH_TOKEN_STORAGE_KEY = "admin-auth-token";
export const AUTH_TOKEN_COOKIE_NAME = AUTH_TOKEN_STORAGE_KEY;
export const CSRF_TOKEN_STORAGE_KEY = "admin-csrf-token";

const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;
const AUTH_COOKIE_SAMESITE = "Strict";

function buildAuthCookieAttributes(maxAgeSeconds: number): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  return `Path=/; Max-Age=${maxAgeSeconds}; SameSite=${AUTH_COOKIE_SAMESITE}${secure}`;
}

export interface PersistAuthSessionOptions {
  csrfToken?: string;
  maxAgeSeconds?: number;
}

export function persistAuthSession(
  token: string,
  options: PersistAuthSessionOptions = {},
): void {
  if (typeof window === "undefined") {
    return;
  }

  const maxAgeSeconds = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  document.cookie = `${AUTH_TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}; ${buildAuthCookieAttributes(maxAgeSeconds)}`;

  if (options.csrfToken) {
    window.localStorage.setItem(CSRF_TOKEN_STORAGE_KEY, options.csrfToken);
  }
}

export function persistCsrfToken(csrfToken: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CSRF_TOKEN_STORAGE_KEY, csrfToken);
}

export function getStoredCsrfToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(CSRF_TOKEN_STORAGE_KEY)?.trim() || null;
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(CSRF_TOKEN_STORAGE_KEY);
  document.cookie = `${AUTH_TOKEN_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=${AUTH_COOKIE_SAMESITE}`;
}
