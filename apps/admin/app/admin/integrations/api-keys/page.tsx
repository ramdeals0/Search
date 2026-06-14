import { ApiKeysPanel } from "../../../api-keys-panel";
import { AdminPageHeader } from "../../admin-page-header";
export default function AdminApiKeysPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Operations"
        title="API keys"
        description="Issue scoped keys for storefront search, browse, and analytics event ingestion."
      />
      <ApiKeysPanel />
    </div>
  );
}
