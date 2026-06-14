import { JitAccessPanel } from "../components/jit-access-panel";
import { AdminPageHeader } from "../../admin-page-header";

export default function AdminAccessJitPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Access"
        title="JIT elevation"
        description="Request temporary role elevation, manage JIT policy, and monitor active privileges."
      />

      <JitAccessPanel />
    </div>
  );
}
