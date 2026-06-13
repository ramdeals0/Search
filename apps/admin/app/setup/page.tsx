import { redirect } from "next/navigation";
import type { BootstrapStateDto } from "@retailer-search/shared-types";
import { ForgeOpsLogo } from "../admin/admin-page-header";
import "../globals.css";
import { SetupWizard } from "./setup-wizard";
import { getSearchApiUrl } from "../lib/search-api-url";

async function fetchSetupStatus(): Promise<BootstrapStateDto> {
  const response = await fetch(`${getSearchApiUrl()}/api/v1/setup/status`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load setup status: HTTP ${response.status}`);
  }

  return (await response.json()) as BootstrapStateDto;
}

export default async function SetupPage() {
  let status: BootstrapStateDto;

  try {
    status = await fetchSetupStatus();
  } catch (error) {
    return (
      <div className="forge-auth-page">
        <div className="forge-auth-card forge-auth-card--wide">
          <ForgeOpsLogo />
          <h1 className="forge-auth-card__title">Initial setup</h1>
          <p style={{ color: "var(--forge-error)", fontSize: 14 }}>
            {error instanceof Error
              ? error.message
              : "Unable to reach the search API setup endpoint."}
          </p>
        </div>
      </div>
    );
  }

  if (!status.setupRequired) {
    redirect("/login");
  }

  return (
    <div className="forge-auth-page" style={{ alignItems: "flex-start", paddingTop: "2.5rem" }}>
      <div className="forge-auth-card forge-auth-card--wide">
        <header className="forge-auth-card__header">
          <ForgeOpsLogo />
          <h1 className="forge-auth-card__title">Configure ForgeOps</h1>
          <p className="forge-auth-card__subtitle">
            Complete first-run setup before normal admin sign-in is enabled.
          </p>
        </header>
        <SetupWizard initialState={status} />
      </div>
    </div>
  );
}
