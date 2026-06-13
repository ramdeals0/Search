export const AUTH_TOKEN_STORAGE_KEY = "admin-auth-token";
export const AUTH_TOKEN_COOKIE_NAME = AUTH_TOKEN_STORAGE_KEY;

const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;

export function persistAuthSession(
  token: string,
  maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  document.cookie = `${AUTH_TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  document.cookie = `${AUTH_TOKEN_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
