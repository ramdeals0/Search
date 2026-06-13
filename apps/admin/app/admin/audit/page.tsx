import { AuditLogPanel } from "../../audit-log-panel";
import { SecurityTimelinePanel } from "../../security-timeline-panel";
import { AdminPageHeader } from "../admin-page-header";

export default function AdminAuditPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Governance"
        title="Audit"
        description="Immutable audit trail and security timeline for merchandising, access, and release events."
      />

      <AuditLogPanel />
      <SecurityTimelinePanel />
    </div>
  );
}
