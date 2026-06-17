import {
  AUTH_TOKEN_COOKIE_NAME,
  AUTH_TOKEN_STORAGE_KEY,
  CSRF_TOKEN_STORAGE_KEY,
  getStoredCsrfToken,
  persistCsrfToken,
} from "../auth-session";
import { getSearchApiUrl } from "./search-api-url";

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
  const csrfToken = getStoredCsrfToken();
  const headers: Record<string, string> = {};

  if (contentType === "json") {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  return headers;
}

let csrfRefreshPromise: Promise<string | null> | null = null;

/** Fetch a fresh CSRF token for the current session from search-api. */
export async function refreshCsrfToken(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  if (!csrfRefreshPromise) {
    csrfRefreshPromise = (async () => {
      try {
        const response = await fetch(`${getSearchApiUrl()}/api/v1/auth/me`, {
          credentials: "same-origin",
          headers: getAuthHeaders("none"),
          cache: "no-store",
        });

        if (!response.ok) {
          return getStoredCsrfToken();
        }

        const body = (await response.json()) as {
          authenticated?: boolean;
          csrfToken?: string;
        };

        if (body.authenticated && body.csrfToken) {
          persistCsrfToken(body.csrfToken);
          return body.csrfToken;
        }
      } catch {
        // Transient network errors fall through to any stored token.
      }

      return getStoredCsrfToken();
    })().finally(() => {
      csrfRefreshPromise = null;
    });
  }

  return csrfRefreshPromise;
}

export async function getAuthHeadersForMutation(
  contentType: "json" | "none" = "json",
): Promise<HeadersInit> {
  await refreshCsrfToken();
  return getAuthHeaders(contentType);
}

function mergeAuthHeaders(
  init: RequestInit | undefined,
  contentType: "json" | "none",
): Headers {
  const headers = new Headers(init?.headers);
  const authHeaders = getAuthHeaders(contentType);

  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }

  return headers;
}

function requestUsesJsonBody(init: RequestInit | undefined): boolean {
  if (init?.body === undefined || init.body === null) {
    return false;
  }

  const headers = new Headers(init.headers);
  const contentType = headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.includes("application/json") || typeof init.body === "string";
}

/** Authenticated fetch with CSRF refresh (and one retry on 403). */
export async function authFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const needsCsrf = !["GET", "HEAD", "OPTIONS"].includes(method);
  const contentType = requestUsesJsonBody(init) ? "json" : "none";

  if (needsCsrf) {
    await refreshCsrfToken();
  }

  let response = await fetch(input, {
    ...init,
    credentials: "same-origin",
    headers: mergeAuthHeaders(init, contentType),
  });

  if (needsCsrf && response.status === 403) {
    await refreshCsrfToken();
    response = await fetch(input, {
      ...init,
      credentials: "same-origin",
      headers: mergeAuthHeaders(init, contentType),
    });
  }

  return response;
}

export { CSRF_TOKEN_STORAGE_KEY };
