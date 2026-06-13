import Link from "next/link";
import type {
  EnvironmentConfigurationDto,
  MerchandisingRule,
  PromotionHistoryResponseDto,
  SuggestionsResponseDto,
} from "@retailer-search/shared-types";
import { getSearchApiUrl } from "../../lib/search-api-url";
import { ActiveConfigBadge } from "../../active-config-badge";
import { EnvironmentSwitcher } from "../../environment-switcher";
import { AdminMetricCard, AdminPageHeader } from "../admin-page-header";

async function fetchRules(environment: "staging" | "live"): Promise<MerchandisingRule[]> {
  const response = await fetch(
    `${getSearchApiUrl()}/api/v1/admin/rules?environment=${environment}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    return [];
  }
  return (await response.json()) as MerchandisingRule[];
}

async function fetchEnvironments(): Promise<EnvironmentConfigurationDto[]> {
  const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/environments`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as { environments: EnvironmentConfigurationDto[] };
  return payload.environments ?? [];
}

async function fetchSuggestionsCount(): Promise<number> {
  const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/suggestions`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return 0;
  }
  const payload = (await response.json()) as SuggestionsResponseDto;
  return payload.suggestions?.length ?? 0;
}

async function fetchPromotions(): Promise<PromotionHistoryResponseDto> {
  const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/promotions`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return { total: 0, entries: [] };
  }
  return (await response.json()) as PromotionHistoryResponseDto;
}

const WORKSPACE_LINKS = [
  {
    href: "/admin/merchandising/rules",
    title: "Rules",
    hint: "Boost, bury, pin, and hide rules in staging",
  },
  {
    href: "/admin/merchandising/snapshots",
    title: "Snapshots",
    hint: "Capture, diff, and roll back configuration",
  },
  {
    href: "/admin/merchandising/promotions",
    title: "Promotions",
    hint: "Promotion history and live configuration",
  },
  {
    href: "/admin/merchandising/suggestions",
    title: "Suggestions",
    hint: "Assisted recommendations from search analytics",
  },
] as const;

const WORKFLOW_LINKS = [
  {
    href: "/admin/merchandising/workflows/new-rule",
    title: "New rule workflow",
    hint: "Guided create with preview before save",
  },
  {
    href: "/admin/merchandising/workflows/new-promotion",
    title: "New promotion workflow",
    hint: "Campaign-style snapshot promotion setup",
  },
  {
    href: "/admin/merchandising/workflows/publish",
    title: "Publish workflow",
    hint: "Review staging, approvals, and go live",
  },
] as const;

export default async function MerchandisingOverviewPage() {
  const [stagingRules, liveRules, environments, suggestionsCount, promotions] =
    await Promise.all([
      fetchRules("staging"),
      fetchRules("live"),
      fetchEnvironments(),
      fetchSuggestionsCount(),
      fetchPromotions(),
    ]);

  const activeStagingRules = stagingRules.filter((rule) => rule.active).length;
  const activeLiveRules = liveRules.filter((rule) => rule.active).length;
  const stagingEnv = environments.find((env) => env.environment === "staging");
  const liveEnv = environments.find((env) => env.environment === "live");
  const stagedChanges =
    Math.abs((stagingEnv?.counts.rules ?? stagingRules.length) - (liveEnv?.counts.rules ?? liveRules.length)) +
    Math.abs(
      (stagingEnv?.counts.synonyms ?? 0) - (liveEnv?.counts.synonyms ?? 0),
    );

  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Merchandising"
        description="Command center for rules, snapshots, promotions, and assisted suggestions. Open a workspace below or start a guided workflow."
        actions={
          <Link href="/admin/merchandising/workflows/publish" className="forge-badge">
            Publish staging
          </Link>
        }
      />

      <div className="forge-page-stack" style={{ marginBottom: "0.25rem" }}>
        <EnvironmentSwitcher />
        <ActiveConfigBadge />
      </div>

      <section>
        <h2 className="forge-section-title">Key metrics</h2>
        <div className="forge-grid-metrics">
          <AdminMetricCard
            label="Active rules (staging)"
            value={String(activeStagingRules)}
            hint={`${stagingRules.length} total in staging`}
          />
          <AdminMetricCard
            label="Staged changes"
            value={String(stagedChanges)}
            hint={
              stagedChanges > 0
                ? "Rule or synonym count differs from live"
                : "Staging counts match live baseline"
            }
          />
          <AdminMetricCard
            label="Promotion history"
            value={String(promotions.total)}
            hint={
              promotions.entries[0]
                ? `Latest: ${promotions.entries[0].snapshotName}`
                : "No promotions recorded yet"
            }
          />
          <AdminMetricCard
            label="Pending suggestions"
            value={String(suggestionsCount)}
            hint="Analytics-backed recommendations awaiting review"
          />
        </div>
      </section>

      <section>
        <h2 className="forge-section-title">Live vs staging</h2>
        <div className="forge-grid-metrics">
          <AdminMetricCard
            label="Live active rules"
            value={String(activeLiveRules)}
            hint={
              liveEnv?.snapshotName
                ? `Linked snapshot: ${liveEnv.snapshotName}`
                : "Live environment baseline"
            }
          />
          <AdminMetricCard
            label="Staging active rules"
            value={String(activeStagingRules)}
            hint={
              stagingEnv?.updatedAt
                ? `Updated ${new Date(stagingEnv.updatedAt).toLocaleString()}`
                : "Staging workspace"
            }
          />
          <AdminMetricCard
            label="Live synonyms"
            value={String(liveEnv?.counts.synonyms ?? 0)}
          />
          <AdminMetricCard
            label="Staging synonyms"
            value={String(stagingEnv?.counts.synonyms ?? 0)}
          />
        </div>
      </section>

      <section>
        <h2 className="forge-section-title">Workspaces</h2>
        <div className="forge-grid-links">
          {WORKSPACE_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="forge-quick-link">
              <div className="forge-quick-link__title">{link.title}</div>
              <div className="forge-quick-link__hint">{link.hint}</div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="forge-section-title">Guided workflows</h2>
        <p className="forge-callout forge-callout--info" style={{ marginBottom: "0.75rem" }}>
          Use step-based flows for create, promote, and publish tasks that benefit from
          sequential review before changes land in staging or live search.
        </p>
        <div className="forge-grid-links">
          {WORKFLOW_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="forge-quick-link">
              <div className="forge-quick-link__title">{link.title}</div>
              <div className="forge-quick-link__hint">{link.hint}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
