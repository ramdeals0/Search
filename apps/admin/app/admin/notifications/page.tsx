import { NotificationInboxPanel } from "../../notification-inbox-panel";
import { AdminPageHeader } from "../admin-page-header";

export default function AdminNotificationsPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Governance"
        title="Notifications"
        description="Approval, access, and system notifications for your workspace role."
      />

      <NotificationInboxPanel />
    </div>
  );
}
