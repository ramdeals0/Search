import { ExportCenterPanel } from "../../export-center-panel";
import { AdminPageHeader } from "../admin-page-header";

export default function AdminExportsPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Operations"
        title="Exports"
        description="Generate and download audit, approval, and governance export jobs."
      />

      <ExportCenterPanel />
    </div>
  );
}
