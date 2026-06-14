import { PluginsPanel } from "../../../plugins-panel";
import { AdminPageHeader } from "../../admin-page-header";

export default function AdminPlatformPluginsPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Platform"
        title="Plugins"
        description="Enable or disable search pipeline plugins for this instance."
      />
      <PluginsPanel />
    </div>
  );
}
