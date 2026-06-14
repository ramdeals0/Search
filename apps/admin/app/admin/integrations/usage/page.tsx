import { ApiUsagePanel } from "../../../api-usage-panel";
import { AdminPageHeader } from "../../admin-page-header";

export default function AdminApiUsagePage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Integrations"
        title="API usage"
        description="Monitor request volume by route and API key over a rolling window."
      />
      <ApiUsagePanel />
    </div>
  );
}
