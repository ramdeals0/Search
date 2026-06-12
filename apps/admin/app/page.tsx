import type {
  BootstrapStateDto,
  MerchandisingRule,
  SearchAnalyticsSummaryDto,
} from "@retailer-search/shared-types";
import { redirect } from "next/navigation";
import { AccessRequestPanel } from "./access-request-panel";
import { AccessReviewPanel } from "./access-review-panel";
import { CurrentUserBadge } from "./components/current-user-badge";
import { ExportCenterPanel } from "./export-center-panel";
import { JitAccessPanel } from "./jit-access-panel";
import { RoleDashboard } from "./role-dashboard";
import { SecurityTimelinePanel } from "./security-timeline-panel";
import { WebhookManagementPanel } from "./webhook-management-panel";

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

async function fetchRules(): Promise<MerchandisingRule[]> {
  const response = await fetch(
    `${SEARCH_API_URL}/api/v1/admin/rules?environment=staging`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Failed to load rules: HTTP ${response.status}`);
  }

  return (await response.json()) as MerchandisingRule[];
}

async function fetchAnalytics(): Promise<SearchAnalyticsSummaryDto> {
  const response = await fetch(
    `${SEARCH_API_URL}/api/v1/admin/analytics/summary`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Failed to load analytics: HTTP ${response.status}`);
  }

  return (await response.json()) as SearchAnalyticsSummaryDto;
}

export default async function AdminPage() {
  try {
    const setupStatus = await fetchSetupStatus();
    if (setupStatus.setupRequired) {
      redirect("/setup");
    }
  } catch {
    // If setup status cannot be loaded, continue and let panels surface API errors.
  }

  let rules: MerchandisingRule[] = [];
  let analytics: SearchAnalyticsSummaryDto = {
    totalSearches: 0,
    totalClicks: 0,
    topQueries: [],
    noResultQueries: [],
  };
  let loadError: string | null = null;

  try {
    [rules, analytics] = await Promise.all([fetchRules(), fetchAnalytics()]);
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load admin data";
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 24 }}>Merchandising Admin</h1>
        <p style={{ margin: "0 0 12px", color: "#475569", fontSize: 14 }}>
          Internal access governance, merchandising controls, and release workflow.
        </p>
        <CurrentUserBadge />
      </header>

      <div style={{ display: "grid", gap: 16, marginBottom: 24 }}>
        <JitAccessPanel />
        <AccessRequestPanel scrollTargetId="access-requests" />
        <AccessReviewPanel />
        <SecurityTimelinePanel />
        <ExportCenterPanel />
        <WebhookManagementPanel />
      </div>

      <RoleDashboard
        initialRules={rules}
        initialAnalytics={analytics}
        loadError={loadError}
      />
    </main>
  );
}
