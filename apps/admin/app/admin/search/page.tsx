import type { SearchAnalyticsSummaryDto } from "@retailer-search/shared-types";
import { AnalyticsPanel } from "../../analytics-panel";
import { QueryPreview } from "../../query-preview";
import { SuggestionsPanel } from "../../suggestions-panel";
import { AdminPageHeader } from "../admin-page-header";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

async function fetchAnalytics(): Promise<SearchAnalyticsSummaryDto> {
  const response = await fetch(`${SEARCH_API_URL}/api/v1/admin/analytics/summary`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return { totalSearches: 0, totalClicks: 0, topQueries: [], noResultQueries: [] };
  }
  return (await response.json()) as SearchAnalyticsSummaryDto;
}

export default async function AdminSearchPage() {
  const analytics = await fetchAnalytics();

  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Search"
        description="Monitor query performance, zero-result queries, assisted suggestions, and live query previews."
      />

      <AnalyticsPanel analytics={analytics} />
      <SuggestionsPanel />
      <QueryPreview />
    </div>
  );
}
