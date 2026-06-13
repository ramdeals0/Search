import type { BootstrapStateDto } from "@retailer-search/shared-types";
import { redirect } from "next/navigation";
import { getSearchApiUrl } from "./lib/search-api-url";

async function fetchSetupStatus(): Promise<BootstrapStateDto | null> {
  try {
    const response = await fetch(`${getSearchApiUrl()}/api/v1/setup/status`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as BootstrapStateDto;
  } catch {
    return null;
  }
}

export default async function RootPage() {
  const setupStatus = await fetchSetupStatus();
  if (setupStatus?.setupRequired) {
    redirect("/setup");
  }

  redirect("/admin");
}
