import Link from "next/link";
import { AdminPageHeader } from "../admin-page-header";

const WORKSPACE_LINKS = [
  {
    href: "/admin/access/jit",
    title: "JIT elevation",
    hint: "Temporary role elevation, policy, and active privileges",
  },
  {
    href: "/admin/access/requests",
    title: "Standing requests",
    hint: "Role change requests and admin resolution",
  },
  {
    href: "/admin/access/reviews",
    title: "Access reviews",
    hint: "Periodic certification runs and user disposition",
  },
] as const;

export default function AdminAccessOverviewPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Governance"
        title="Access"
        description="Command center for just-in-time elevation, standing role requests, and periodic access reviews. Reviewer identities live under Approvals."
      />

      <section>
        <h2 className="forge-section-title">Workspaces</h2>
        <p className="forge-callout forge-callout--info" style={{ marginBottom: "0.75rem" }}>
          Open a focused workspace below. JIT handles temporary elevation; standing requests
          cover permanent role changes; access reviews support certification campaigns.
        </p>
        <div className="forge-grid-links">
          {WORKSPACE_LINKS.map((link) => (
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
