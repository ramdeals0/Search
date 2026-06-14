import { ContentModulesPanel } from "../../../content-modules-panel";
import { AdminPageHeader } from "../../admin-page-header";

export default function MerchandisingModulesPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Merchandising"
        title="Content modules"
        description="Manage searchable content modules such as banners, category rails, and contextual messages."
      />
      <ContentModulesPanel />
    </div>
  );
}
