import { AccessReviewPanel } from "../components/access-review-panel";
import { AdminPageHeader } from "../../admin-page-header";

export default function AdminAccessReviewsPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Access"
        title="Access reviews"
        description="Launch certification runs, resolve per-user findings, and complete review campaigns."
      />

      <AccessReviewPanel />
    </div>
  );
}
