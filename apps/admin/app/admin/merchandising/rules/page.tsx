import Link from "next/link";
import type { MerchandisingRule } from "@retailer-search/shared-types";
import { RulesTable } from "../../../rules-table";
import { AdminMetricCard, AdminPageHeader } from "../../admin-page-header";
import { getSearchApiUrl } from "../../../lib/search-api-url";

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

export default async function MerchandisingRulesPage() {
  const rules = await fetchRules();
  const activeRules = rules.filter((rule) => rule.active).length;
  const boostRules = rules.filter((rule) => rule.action === "boost").length;
  const pinRules = rules.filter((rule) => rule.action === "pin").length;

  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Merchandising"
        title="Rules"
        description="Persistent management for boost, bury, pin, and hide rules in the staging environment."
        actions={<span className="forge-badge">{rules.length} rules loaded</span>}
      />

      <section>
        <h2 className="forge-section-title">Summary</h2>
        <div className="forge-grid-metrics">
          <AdminMetricCard label="Total rules" value={String(rules.length)} />
          <AdminMetricCard label="Active" value={String(activeRules)} />
          <AdminMetricCard label="Boost rules" value={String(boostRules)} />
          <AdminMetricCard label="Pin rules" value={String(pinRules)} />
        </div>
      </section>

      <section>
        <h2 className="forge-section-title">Rule management</h2>
        {rules.length === 0 ? (
          <div className="forge-callout forge-callout--dashed">
            No merchandising rules in staging yet. Create one inline below or use{" "}
            <Link href="/admin/merchandising/workflows/new-rule">Guided new rule</Link> in
            the sidebar.
          </div>
        ) : null}
        <RulesTable initialRules={rules} />
      </section>
    </div>
  );
}
