import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_TOKEN_COOKIE_NAME } from "../../auth-session";

function getSearchApiBaseUrl(): string {
  const base =
    process.env.SEARCH_API_URL ??
    process.env.NEXT_PUBLIC_SEARCH_API_URL ??
    "http://localhost:4001";

  return base.replace(/\/$/, "");
}

const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "x-request-id",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
] as const;

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[] | undefined,
): Promise<NextResponse> {
  const path = pathSegments?.join("/") ?? "";
  const target = new URL(`${getSearchApiBaseUrl()}/${path}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("authorization", authorization);
  } else {
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const prefix = `${AUTH_TOKEN_COOKIE_NAME}=`;
      const match = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(prefix));
      if (match) {
        const raw = match.slice(prefix.length);
        try {
          const token = decodeURIComponent(raw);
          if (token) {
            headers.set("authorization", `Bearer ${token}`);
          }
        } catch {
          if (raw) {
            headers.set("authorization", `Bearer ${raw}`);
          }
        }
      }
    }
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  let response: Response;
  try {
    response = await fetch(target, init);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Search API request failed";
    return NextResponse.json(
      {
        error: "search_api_unreachable",
        message: `Cannot reach search API at ${getSearchApiBaseUrl()}. ${message}`,
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value) {
      responseHeaders.set(name, value);
    }
  }

  return new NextResponse(await response.arrayBuffer(), {
    status: response.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path?: string[] }> };

async function handle(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
