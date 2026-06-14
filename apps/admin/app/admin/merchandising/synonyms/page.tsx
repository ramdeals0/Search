import type { EnvironmentKey, SynonymListResponseDto } from "@retailer-search/shared-types";
import { SynonymsPanel } from "../../../synonyms-panel";
import { AdminMetricCard, AdminPageHeader } from "../../admin-page-header";
import { getSearchApiUrl } from "../../../lib/search-api-url";

async function fetchSynonymCount(
  environment: EnvironmentKey,
): Promise<number> {
  const response = await fetch(
    `${getSearchApiUrl()}/api/v1/admin/synonyms?environment=${environment}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    return 0;
  }

  const body = (await response.json()) as SynonymListResponseDto;
  return body.total ?? body.synonyms.length;
}

export default async function MerchandisingSynonymsPage() {
  const [stagingCount, liveCount] = await Promise.all([
    fetchSynonymCount("staging"),
    fetchSynonymCount("live"),
  ]);

  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Merchandising"
        title="Synonyms"
        description="View and manage query normalization mappings for staging and live search."
        actions={
          <span className="forge-badge">{stagingCount} staging synonyms</span>
        }
      />

      <section>
        <h2 className="forge-section-title">Summary</h2>
        <div className="forge-grid-metrics">
          <AdminMetricCard label="Staging synonyms" value={String(stagingCount)} />
          <AdminMetricCard label="Live synonyms" value={String(liveCount)} />
        </div>
      </section>

      <section>
        <h2 className="forge-section-title">Synonym management</h2>
        <SynonymsPanel />
      </section>
    </div>
  );
}
