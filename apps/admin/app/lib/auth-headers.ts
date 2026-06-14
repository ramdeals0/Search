import { AUTH_TOKEN_COOKIE_NAME, AUTH_TOKEN_STORAGE_KEY } from "../auth-session";

function readTokenFromCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${AUTH_TOKEN_COOKIE_NAME}=`;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match.slice(prefix.length));
  } catch {
    return match.slice(prefix.length);
  }
}

export function getAdminAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)?.trim() ||
    readTokenFromCookie()?.trim() ||
    null
  );
}

export function getAuthHeaders(
  contentType: "json" | "none" = "json",
): HeadersInit {
  const token = getAdminAuthToken();
  const headers: Record<string, string> = {};

  if (contentType === "json") {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}
