import { AnalyticsPanel } from "../../analytics-panel";
import { ZeroResultsPanel } from "../../zero-results-panel";
import { QueryPreview } from "../../query-preview";
import { SuggestionsPanel } from "../../suggestions-panel";
import { AdminPageHeader } from "../admin-page-header";

export default function AdminSearchPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Search"
        description="Monitor query performance, zero-result queries, assisted suggestions, and live query previews."
      />

      <AnalyticsPanel />
      <ZeroResultsPanel />
      <SuggestionsPanel />
      <QueryPreview />
    </div>
  );
}
