import { ApprovalPanel } from "../../approval-panel";
import { ApprovalPolicyPanel } from "../../approval-policy-panel";
import { ApprovalSlaPanel } from "../../approval-sla-panel";
import { DelegationPanel } from "../../delegation-panel";
import { ExceptionQueuePanel } from "../../exception-queue-panel";
import { PromotionPanel } from "../../promotion-panel";
import { ReviewerManagementPanel } from "../../reviewer-management-panel";
import { AdminPageHeader } from "../admin-page-header";

export default function AdminApprovalsPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Governance"
        title="Approvals"
        description="Review pending release approvals, SLA posture, exceptions, and promotion execution."
      />

      <ApprovalPanel />
      <ApprovalSlaPanel />
      <ExceptionQueuePanel />
      <DelegationPanel />
      <ReviewerManagementPanel />
      <ApprovalPolicyPanel />
      <PromotionPanel />
    </div>
  );
}
