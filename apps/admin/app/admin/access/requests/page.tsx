import { AccessRequestPanel } from "../components/access-request-panel";
import { AdminPageHeader } from "../../admin-page-header";

export default function AdminAccessRequestsPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Access"
        title="Standing requests"
        description="Submit and resolve standing role change requests for platform users."
      />

      <AccessRequestPanel />
    </div>
  );
}
