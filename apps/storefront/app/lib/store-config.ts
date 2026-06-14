/** Catalog id for this storefront instance (multi-tenant demo). */
export function getStoreCatalogId(): string {
  const configured =
    process.env.NEXT_PUBLIC_CATALOG_ID ??
    process.env.STORE_CATALOG_ID ??
    "default";

  const trimmed = configured.trim();
  return trimmed.length > 0 ? trimmed : "default";
}

export function getCatalogRequestHeaders(
  extra?: HeadersInit,
): HeadersInit {
  const headers = new Headers(extra);
  headers.set("x-catalog-id", getStoreCatalogId());
  return headers;
}

/** Adds catalogId query param for server-side API calls that bypass the proxy. */
export function withCatalogScope(url: URL): URL {
  url.searchParams.set("catalogId", getStoreCatalogId());
  return url;
}
