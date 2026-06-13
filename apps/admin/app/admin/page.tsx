import Link from "next/link";
import type {
  MerchandisingRule,
  SearchAnalyticsSummaryDto,
} from "@retailer-search/shared-types";
import { getSearchApiUrl } from "../lib/search-api-url";
import { ActiveConfigBadge } from "../active-config-badge";
import { EnvironmentSwitcher } from "../environment-switcher";
import { DashboardOverviewWidgets } from "./admin-shell";
import { AdminPageHeader } from "./admin-page-header";

async function fetchRules(): Promise<MerchandisingRule[]> {
  const response = await fetch(
    `${getSearchApiUrl()}/api/v1/admin/rules?environment=staging`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    return [];
  }
  return (await response.json()) as MerchandisingRule[];
}

async function fetchAnalytics(): Promise<SearchAnalyticsSummaryDto> {
  const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/analytics/summary`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return { totalSearches: 0, totalClicks: 0, topQueries: [], noResultQueries: [] };
  }
  return (await response.json()) as SearchAnalyticsSummaryDto;
}

const QUICK_LINKS = [
  { href: "/admin/products", label: "Products", hint: "Catalog lookup and SKU context" },
  { href: "/admin/search", label: "Search analytics", hint: "Queries, zero-results, performance" },
  { href: "/admin/merchandising", label: "Merchandising", hint: "Rules, boosts, promotions" },
  { href: "/admin/experiments", label: "Experiments", hint: "A/B configs and scorecards" },
  { href: "/admin/approvals", label: "Approvals", hint: "Pending release approvals" },
  { href: "/admin/access", label: "Access", hint: "JIT, requests, reviews" },
  { href: "/admin/audit", label: "Audit", hint: "Trail and security timeline" },
  { href: "/admin/notifications", label: "Notifications", hint: "Inbox and alerts" },
  { href: "/admin/exports", label: "Exports", hint: "Export jobs and downloads" },
  { href: "/admin/integrations", label: "Integrations", hint: "Webhooks and delivery logs" },
  { href: "/admin/settings", label: "Settings", hint: "Platform and environment defaults" },
] as const;

export default async function AdminDashboardPage() {
  const [rules, analytics] = await Promise.all([fetchRules(), fetchAnalytics()]);
  const activeRules = rules.filter((rule) => rule.active).length;
  const zeroResultCount = analytics.noResultQueries.length;
  const ctr =
    analytics.totalSearches > 0
      ? ((analytics.totalClicks / analytics.totalSearches) * 100).toFixed(1)
      : "0.0";

  return (
    <>
      <div className="forge-welcome-banner">
        <div>
          <span className="forge-badge">ForgeOps</span>
          <h2 className="forge-welcome-banner__title">Operations control center</h2>
          <p className="forge-welcome-banner__text">
            Monitor search performance, merchandising posture, and governance activity across
            your home-improvement catalog. Use the sidebar or quick links to open a workspace.
          </p>
        </div>
      </div>

      <AdminPageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Executive snapshot of catalog search, merchandising rules, and platform activity."
      />

      <div className="forge-page-stack" style={{ marginBottom: "1.25rem" }}>
        <EnvironmentSwitcher />
        <ActiveConfigBadge />
      </div>

      <DashboardOverviewWidgets analytics={analytics} />

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 className="forge-section-title">Key metrics</h2>
        <div className="forge-grid-metrics">
          <MetricCard label="Active rules (staging)" value={String(activeRules)} />
          <MetricCard label="Total searches" value={String(analytics.totalSearches)} />
          <MetricCard label="Total clicks" value={String(analytics.totalClicks)} />
          <MetricCard label="Search CTR" value={`${ctr}%`} />
          <MetricCard
            label="Top query"
            value={analytics.topQueries[0]?.query ?? "—"}
            hint={
              analytics.topQueries[0]
                ? `${analytics.topQueries[0].count} searches`
                : "Run storefront searches to populate"
            }
          />
          <MetricCard
            label="Zero-result queries"
            value={String(zeroResultCount)}
            hint={zeroResultCount > 0 ? "Review in Search workspace" : "No gaps detected"}
          />
        </div>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 className="forge-section-title">System state</h2>
        <ul className="forge-activity-list">
          <li className="forge-activity-item">
            <span className="forge-activity-item__label">Staging merchandising rules loaded</span>
            <span className="forge-activity-item__value">{rules.length}</span>
          </li>
          <li className="forge-activity-item">
            <span className="forge-activity-item__label">Search events recorded</span>
            <span className="forge-activity-item__value">{analytics.totalSearches}</span>
          </li>
          <li className="forge-activity-item">
            <span className="forge-activity-item__label">Click-through events</span>
            <span className="forge-activity-item__value">{analytics.totalClicks}</span>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="forge-section-title">Quick links</h2>
        <div className="forge-grid-links">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="forge-quick-link">
              <div className="forge-quick-link__title">{link.label}</div>
              <div className="forge-quick-link__hint">{link.hint}</div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function MetricCard(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="forge-card forge-card--metric">
      <div className="forge-card__label">{props.label}</div>
      <div className="forge-card__value">{props.value}</div>
      {props.hint ? <div className="forge-card__hint">{props.hint}</div> : null}
    </div>
  );
}
