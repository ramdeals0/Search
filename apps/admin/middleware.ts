import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { CurrentUserResponseDto } from "@retailer-search/shared-types";
import { AUTH_TOKEN_COOKIE_NAME } from "./app/auth-session";
import { getSearchApiBaseUrl } from "./app/lib/search-api-base-url";

function redirectToLogin(request: NextRequest, clearSession = false): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", request.nextUrl.pathname);

  const response = NextResponse.redirect(loginUrl);
  if (clearSession) {
    response.cookies.set(AUTH_TOKEN_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}

async function hasValidSession(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${getSearchApiBaseUrl()}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      return false;
    }

    const body = (await response.json()) as CurrentUserResponseDto;
    return body.authenticated === true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_TOKEN_COOKIE_NAME)?.value?.trim();

  if (!token) {
    return redirectToLogin(request);
  }

  const valid = await hasValidSession(token);
  if (!valid) {
    return redirectToLogin(request, true);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
