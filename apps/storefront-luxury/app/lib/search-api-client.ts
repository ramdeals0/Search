import { buildSearchApiUrl } from "./search-api-url";
import { getCatalogRequestHeaders, getStoreCatalogId } from "./store-config";

export interface SearchApiRequestOptions
  extends Omit<RequestInit, "body" | "headers" | "method"> {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
  sessionId?: string;
}

export async function fetchSearchApi(
  path: string,
  { method = "GET", body, headers, sessionId, ...rest }: SearchApiRequestOptions = {},
): Promise<Response> {
  const requestHeaders = new Headers(headers);

  if (body !== undefined && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (sessionId) {
    requestHeaders.set("x-session-id", sessionId);
  }
  if (!requestHeaders.has("x-catalog-id")) {
    requestHeaders.set("x-catalog-id", getStoreCatalogId());
  }

  const url = buildSearchApiUrl(path);
  url.searchParams.set("catalogId", getStoreCatalogId());
  return fetch(url, {
    ...rest,
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
