import { CatalogsPanel } from "../../../catalogs-panel";
import { AdminPageHeader } from "../../admin-page-header";

export default function AdminPlatformCatalogsPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Platform"
        title="Catalogs"
        description="Register and manage product catalogs for multi-catalog tenants."
      />
      <CatalogsPanel />
    </div>
  );
}
