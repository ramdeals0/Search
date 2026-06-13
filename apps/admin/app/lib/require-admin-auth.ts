import type { CurrentUserResponseDto } from "@retailer-search/shared-types";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_TOKEN_COOKIE_NAME } from "../auth-session";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

export async function requireAdminAuth(): Promise<CurrentUserResponseDto> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_TOKEN_COOKIE_NAME)?.value?.trim();

  if (!token) {
    redirect("/login");
  }

  try {
    const response = await fetch(`${SEARCH_API_URL}/api/v1/auth/me`, {
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
