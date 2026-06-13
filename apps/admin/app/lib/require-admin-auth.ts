import type { CurrentUserResponseDto } from "@retailer-search/shared-types";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_TOKEN_COOKIE_NAME } from "../auth-session";
import { getSearchApiUrl } from "./search-api-url";

export async function requireAdminAuth(): Promise<CurrentUserResponseDto> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_TOKEN_COOKIE_NAME)?.value?.trim();

  if (!token) {
    redirect("/login");
  }

  try {
    const response = await fetch(`${getSearchApiUrl()}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      redirect("/login");
    }

    const body = (await response.json()) as CurrentUserResponseDto;
    if (!body.authenticated) {
      redirect("/login");
    }

    return body;
  } catch {
    redirect("/login");
  }
}
