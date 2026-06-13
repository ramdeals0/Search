import { AccessRequestPanel } from "../../access-request-panel";
import { AccessReviewPanel } from "../../access-review-panel";
import { JitAccessPanel } from "../../jit-access-panel";
import { ReviewerManagementPanel } from "../../reviewer-management-panel";
import { AdminPageHeader } from "../admin-page-header";

export default function AdminAccessPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Governance"
        title="Access"
        description="Standing role changes, just-in-time elevation, access reviews, and reviewer assignments."
      />

      <JitAccessPanel />
      <AccessRequestPanel scrollTargetId="access-requests" />
      <AccessReviewPanel />
      <ReviewerManagementPanel />
    </div>
  );
}
