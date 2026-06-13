import Link from "next/link";
import type { SuggestionsResponseDto } from "@retailer-search/shared-types";
import { SuggestionsPanel } from "../../../suggestions-panel";
import { AdminMetricCard, AdminPageHeader } from "../../admin-page-header";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

async function fetchSuggestions(): Promise<SuggestionsResponseDto | null> {
  const response = await fetch(`${SEARCH_API_URL}/api/v1/admin/suggestions`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as SuggestionsResponseDto;
}

export default async function MerchandisingSuggestionsPage() {
  const payload = await fetchSuggestions();
  const suggestions = payload?.suggestions ?? [];
  const highPriority = suggestions.filter((item) => item.priority === "high").length;
  const createRule = suggestions.filter((item) =>
    item.suggestedActionTypes?.includes("create_rule"),
  ).length;

  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Merchandising"
        title="Suggestions"
        description="Analytics-backed recommendations to improve search relevance and coverage."
        actions={
          <Link href="/admin/merchandising/rules" className="forge-badge" style={{ textDecoration: "none" }}>
            Open rules
          </Link>
        }
      />

      <section>
        <h2 className="forge-section-title">Summary</h2>
        <div className="forge-grid-metrics">
          <AdminMetricCard
            label="Open suggestions"
            value={String(suggestions.length)}
            hint={
              payload?.generatedAt
                ? `Generated ${new Date(payload.generatedAt).toLocaleString()}`
                : "Suggestions unavailable"
            }
          />
          <AdminMetricCard label="High priority" value={String(highPriority)} />
          <AdminMetricCard label="Create-rule actions" value={String(createRule)} />
          <AdminMetricCard
            label="Status"
            value={payload ? "Ready" : "Unavailable"}
            hint={payload ? "Review and apply below" : "Search API suggestions endpoint failed"}
          />
        </div>
      </section>

      <section>
        <h2 className="forge-section-title">Suggestion inbox</h2>
        {!payload ? (
          <div className="forge-callout forge-callout--dashed" style={{ marginBottom: "0.75rem" }}>
            Could not load suggestions. Confirm the search API is running and try again.
          </div>
        ) : suggestions.length === 0 ? (
          <div className="forge-callout forge-callout--dashed" style={{ marginBottom: "0.75rem" }}>
            No suggestions right now. Run storefront searches to populate analytics signals.
          </div>
        ) : null}
        <SuggestionsPanel />
      </section>
    </div>
  );
}
