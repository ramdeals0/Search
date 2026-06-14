/**
 * Browser calls use the same-origin `/search-api` proxy route.
 * Server components call SEARCH_API_URL directly at runtime.
 */
function resolveServerSearchApiUrl(): string {
  const configured =
    process.env.SEARCH_API_URL ??
    process.env.NEXT_PUBLIC_SEARCH_API_URL ??
    "http://localhost:4001";

  return configured.trim() || "http://localhost:4001";
}

export function getSearchApiUrl(): string {
  if (typeof window !== "undefined") {
    return "/search-api";
  }

  return resolveServerSearchApiUrl();
}

/** Build a URL for search-api endpoints (supports relative `/search-api` in the browser). */
export function buildSearchApiUrl(path: string): URL {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getSearchApiUrl();

  if (base.startsWith("http://") || base.startsWith("https://")) {
    return new URL(normalizedPath, base.endsWith("/") ? base : `${base}/`);
  }

  if (typeof window !== "undefined") {
    return new URL(`${base}${normalizedPath}`, window.location.origin);
  }

  return new URL(normalizedPath, resolveServerSearchApiUrl());
}
