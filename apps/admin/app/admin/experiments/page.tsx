import { DecisionPanel } from "../../decision-panel";
import { ExperimentRunView } from "../../experiment-run-view";
import { ExperimentsPanel } from "../../experiments-panel";
import { QuerySetEditor } from "../../query-set-editor";
import { ScorecardPanel } from "../../scorecard-panel";
import { AdminPageHeader } from "../admin-page-header";

export default function AdminExperimentsPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Experiments"
        description="Configure query sets, run search experiments, review scorecards, and record release decisions."
      />

      <QuerySetEditor />
      <ExperimentsPanel />
      <ExperimentRunView />
      <ScorecardPanel />
      <DecisionPanel />
    </div>
  );
}
