import { ZeroResultsPanel } from "../../../zero-results-panel";
import { AdminPageHeader } from "../../admin-page-header";
export default function AdminZeroResultsPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Zero-results inbox"
        description="Review durable zero-result queries, generate LLM rule drafts, and apply approved fixes to staging."
      />
      <ZeroResultsPanel />
    </div>
  );
}
