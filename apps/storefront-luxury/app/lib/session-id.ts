const SESSION_COOKIE_NAME = "shopper-session-id";
const LOCAL_STORAGE_KEY = "shopper-session-id";
const SESSION_TTL_DAYS = 365;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;
  const parts = document.cookie.split(";");

  for (const part of parts) {
    const value = part.trim();
    if (value.startsWith(prefix)) {
      const cookieValue = value.slice(prefix.length);
      return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
  }

  return null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") {
    return;
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_TTL_DAYS);
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const cookieSession = readCookie(SESSION_COOKIE_NAME);
  if (cookieSession) {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, cookieSession);
    } catch {
      // localStorage can fail in private mode or restricted contexts.
    }
    return cookieSession;
  }

  let localStorageSession: string | null = null;
  try {
    localStorageSession = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  } catch {
    localStorageSession = null;
  }

  if (localStorageSession) {
    writeCookie(SESSION_COOKIE_NAME, localStorageSession);
    return localStorageSession;
  }

  const created = createSessionId();
  writeCookie(SESSION_COOKIE_NAME, created);
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, created);
  } catch {
    // Best effort persistence only.
  }
  return created;
}
