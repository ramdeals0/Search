import { AiSearchSettingsPanel } from "../../ai-search-settings-panel";
import { AdminPageHeader } from "../admin-page-header";

export default function AdminAiSearchPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Catalog"
        title="AI Search"
        description="Configure hybrid lexical + semantic ranking, embeddings coverage, personalization, and reindex jobs."
      />

      <AiSearchSettingsPanel />
    </div>
  );
}
