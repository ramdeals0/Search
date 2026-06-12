import { redirect } from "next/navigation";
import type { BootstrapStateDto } from "@retailer-search/shared-types";
import { SetupWizard } from "./setup-wizard";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

async function fetchSetupStatus(): Promise<BootstrapStateDto> {
  const response = await fetch(`${SEARCH_API_URL}/api/v1/setup/status`, {
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
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <h1 style={{ marginTop: 0 }}>Initial setup</h1>
        <p style={{ color: "#b91c1c" }}>
          {error instanceof Error
            ? error.message
            : "Unable to reach the search API setup endpoint."}
        </p>
      </main>
    );
  }

  if (!status.setupRequired) {
    redirect("/login");
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24 }}>Initial setup</h1>
        <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>
          Configure this instance before normal admin sign-in is enabled.
        </p>
      </header>
      <SetupWizard initialState={status} />
    </main>
  );
}
