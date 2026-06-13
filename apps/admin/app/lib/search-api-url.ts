/**
 * Browser calls use the same-origin `/search-api` proxy route (app/search-api/[[...path]]/route.ts).
 * Server components call SEARCH_API_URL directly at runtime.
 */
export function getSearchApiUrl(): string {
  if (typeof window !== "undefined") {
    return "/search-api";
  }

  return (
    process.env.SEARCH_API_URL ??
    process.env.NEXT_PUBLIC_SEARCH_API_URL ??
    "http://localhost:4001"
  );
}
