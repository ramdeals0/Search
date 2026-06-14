/** Absolute search-api base URL for server and edge runtimes (never `/search-api` proxy). */
export function getSearchApiBaseUrl(): string {
  return (
    process.env.SEARCH_API_URL ??
    process.env.NEXT_PUBLIC_SEARCH_API_URL ??
    "http://localhost:4001"
  ).replace(/\/$/, "");
}
