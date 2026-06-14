import { ApiUsagePanel } from "../../api-usage-panel";
import { DeveloperKeysPanel } from "../../developer-keys-panel";
import { AdminPageHeader } from "../admin-page-header";

export default function AdminDeveloperPortalPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Developer"
        title="Developer portal"
        description="Self-service API keys and usage metrics for integrations."
      />
      <DeveloperKeysPanel />
      <ApiUsagePanel />
    </div>
  );
}
