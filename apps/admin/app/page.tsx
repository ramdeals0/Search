import type {
  MerchandisingRule,
  SearchAnalyticsSummaryDto,
} from "@retailer-search/shared-types";
import { ApprovalPanel } from "./approval-panel";
import { ApprovalPolicyPanel } from "./approval-policy-panel";
import { ApprovalSlaPanel } from "./approval-sla-panel";
import { ActiveConfigBadge } from "./active-config-badge";
import { AnalyticsPanel } from "./analytics-panel";
import { AuditLogPanel } from "./audit-log-panel";
import { DecisionPanel } from "./decision-panel";
import { EnvironmentPanel } from "./environment-panel";
import { EnvironmentSwitcher } from "./environment-switcher";
import { ExperimentRunView } from "./experiment-run-view";
import { ExperimentsPanel } from "./experiments-panel";
import { NotificationInboxPanel } from "./notification-inbox-panel";
import { PromotionPanel } from "./promotion-panel";
import { QueryPreview } from "./query-preview";
import { QuerySetEditor } from "./query-set-editor";
import { ReviewerManagementPanel } from "./reviewer-management-panel";
import { RulesTable } from "./rules-table";
import { ScorecardPanel } from "./scorecard-panel";
import { SnapshotsPanel } from "./snapshots-panel";
import { SuggestionsPanel } from "./suggestions-panel";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

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
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: "0 0 0.35rem" }}>Merchandising Admin</h1>
        <p style={{ margin: 0, color: "#64748b" }}>
          Internal tooling for analytics, suggestions, rules, snapshots,
          experiments, scorecards, decisions, approvals, SLA tracking,
          notifications, reviewers, promotions, environments, and audit history.
        </p>
        <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.75rem" }}>
          <EnvironmentSwitcher />
          <ActiveConfigBadge />
        </div>
      </header>

      {loadError && (
        <p
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: 8,
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 14,
          }}
        >
          {loadError}. Make sure search-api is running on {SEARCH_API_URL}.
        </p>
      )}

      <div style={{ display: "grid", gap: "1.25rem" }}>
        <EnvironmentPanel />
        <AnalyticsPanel analytics={analytics} />
        <SuggestionsPanel />
        <div id="query-preview-section">
          <QueryPreview />
        </div>
        <RulesTable initialRules={rules} />
        <SnapshotsPanel />
        <QuerySetEditor />
        <ExperimentsPanel />
        <div
          style={{
            padding: "0.85rem 1rem",
            border: "1px dashed #cbd5e1",
            borderRadius: 8,
            background: "#f8fafc",
            fontSize: 13,
            color: "#475569",
          }}
        >
          <strong>Release workflow:</strong> 1) edit in staging · 2) run
          experiment · 3) scorecard + ship decision · 4) create approval request ·
          5) two-person approve · 6) release manager executes to live · 7) SLA
          reminders and inbox track pending approvals
        </div>
        <ExperimentRunView />
        <ScorecardPanel />
        <DecisionPanel />
        <ReviewerManagementPanel />
        <ApprovalPolicyPanel />
        <ApprovalSlaPanel />
        <NotificationInboxPanel />
        <ApprovalPanel />
        <PromotionPanel />
        <AuditLogPanel />
      </div>
    </main>
  );
}
