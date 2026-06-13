/**
 * Browser calls use the same-origin `/search-api` proxy (see next.config.ts rewrites).
 * Server components use SEARCH_API_URL at runtime so production deploys do not depend
 * on a build-time NEXT_PUBLIC value alone.
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
