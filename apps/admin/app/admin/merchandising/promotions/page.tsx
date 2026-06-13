import Link from "next/link";
import type { PromotionHistoryResponseDto } from "@retailer-search/shared-types";
import { PromotionPanel } from "../../../promotion-panel";
import { AdminMetricCard, AdminPageHeader } from "../../admin-page-header";
import { getSearchApiUrl } from "../../../lib/search-api-url";

async function fetchPromotions(): Promise<PromotionHistoryResponseDto> {
  const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/promotions`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return { total: 0, entries: [] };
  }
  return (await response.json()) as PromotionHistoryResponseDto;
}

export default async function MerchandisingPromotionsPage() {
  const promotions = await fetchPromotions();
  const latest = promotions.entries[0];

  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Merchandising"
        title="Promotions"
        description="Review promotion history, active live configuration, and promote approved snapshots."
        actions={
          <>
            <Link
              href="/admin/merchandising/workflows/new-promotion"
              className="forge-badge"
              style={{ textDecoration: "none" }}
            >
              Guided promotion
            </Link>
            <span className="forge-badge">{promotions.total} in history</span>
          </>
        }
      />

      <section>
        <h2 className="forge-section-title">Summary</h2>
        <div className="forge-grid-metrics">
          <AdminMetricCard label="Total promotions" value={String(promotions.total)} />
          <AdminMetricCard
            label="Latest promoted snapshot"
            value={latest?.snapshotName ?? "—"}
            hint={
              latest
                ? new Date(latest.promotedAt).toLocaleString()
                : "No promotions recorded yet"
            }
          />
          <AdminMetricCard
            label="Latest reason"
            value={latest?.reason ? "Recorded" : "—"}
            hint={latest?.reason ?? "Promotion reason appears after first promote"}
          />
          <AdminMetricCard
            label="Source experiment"
            value={latest?.sourceExperimentId ?? "—"}
            hint="Optional experiment linkage"
          />
        </div>
      </section>

      <section>
        <h2 className="forge-section-title">Promotion management</h2>
        {promotions.total === 0 ? (
          <div className="forge-callout forge-callout--dashed" style={{ marginBottom: "0.75rem" }}>
            No promotions yet. Save a snapshot first, then promote via the panel below or the{" "}
            <Link href="/admin/merchandising/workflows/new-promotion">guided workflow</Link>.
          </div>
        ) : null}
        <PromotionPanel />
      </section>
    </div>
  );
}
