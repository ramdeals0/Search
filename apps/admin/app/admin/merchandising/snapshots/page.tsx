import Link from "next/link";
import type { MerchandisingConfigSnapshotDto } from "@retailer-search/shared-types";
import { SnapshotsPanel } from "../../../snapshots-panel";
import { AdminMetricCard, AdminPageHeader } from "../../admin-page-header";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

async function fetchSnapshots(): Promise<MerchandisingConfigSnapshotDto[]> {
  const response = await fetch(`${SEARCH_API_URL}/api/v1/admin/snapshots`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as { snapshots: MerchandisingConfigSnapshotDto[] };
  return payload.snapshots ?? [];
}

export default async function MerchandisingSnapshotsPage() {
  const snapshots = await fetchSnapshots();
  const latest = snapshots[0];
  const totalRules = snapshots.reduce(
    (sum, snapshot) => sum + (snapshot.counts?.rules ?? 0),
    0,
  );

  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Merchandising"
        title="Snapshots"
        description="Capture staging configuration, compare diffs, and roll back when needed."
        actions={
          <Link
            href="/admin/merchandising/workflows/publish"
            className="forge-badge"
            style={{ textDecoration: "none" }}
          >
            Publish workflow
          </Link>
        }
      />

      <section>
        <h2 className="forge-section-title">Summary</h2>
        <div className="forge-grid-metrics">
          <AdminMetricCard label="Snapshots saved" value={String(snapshots.length)} />
          <AdminMetricCard
            label="Latest snapshot"
            value={latest?.name ?? "—"}
            hint={latest ? `${latest.counts?.rules ?? 0} rules captured` : "Create your first snapshot"}
          />
          <AdminMetricCard
            label="Rules captured (latest)"
            value={String(latest?.counts?.rules ?? 0)}
          />
          <AdminMetricCard
            label="Rules captured (all)"
            value={String(totalRules)}
            hint="Sum across saved snapshots"
          />
        </div>
      </section>

      <section>
        <h2 className="forge-section-title">Snapshot management</h2>
        {snapshots.length === 0 ? (
          <div className="forge-callout forge-callout--dashed" style={{ marginBottom: "0.75rem" }}>
            No snapshots yet. Use the panel below to capture the current staging configuration
            before promoting or experimenting.
          </div>
        ) : null}
        <SnapshotsPanel />
      </section>
    </div>
  );
}
