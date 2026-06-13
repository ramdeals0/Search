import { WebhookManagementPanel } from "../../webhook-management-panel";
import { AdminPageHeader } from "../admin-page-header";

export default function AdminIntegrationsPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Operations"
        title="Integrations"
        description="Webhook endpoints, delivery logs, and external event receivers."
      />

      <WebhookManagementPanel />

      <div className="forge-callout forge-callout--dashed">
        Additional connectors (catalog feeds, identity providers, observability) can be added
        here in future phases.
      </div>
    </div>
  );
}
