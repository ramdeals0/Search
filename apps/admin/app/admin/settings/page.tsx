import Link from "next/link";
import { ActiveConfigBadge } from "../../active-config-badge";
import { AiSearchSettingsPanel } from "../../ai-search-settings-panel";
import { ApprovalPolicyPanel } from "../../approval-policy-panel";
import { EnvironmentPanel } from "../../environment-panel";
import { EnvironmentSwitcher } from "../../environment-switcher";
import { BrandingPanel } from "../../branding-panel";
import { LlmSettingsPanel } from "../../llm-settings-panel";
import { AdminPageHeader } from "../admin-page-header";

export default function AdminSettingsPage() {
  return (
    <div className="forge-page-stack--loose">
      <AdminPageHeader
        eyebrow="Operations"
        title="Settings"
        description="Environment configuration, LLM and AI hybrid search settings, approval policies, and ForgeOps platform defaults."
      />

      <EnvironmentSwitcher />
      <ActiveConfigBadge />
      <EnvironmentPanel />
      <BrandingPanel />
      <LlmSettingsPanel />

      <section className="forge-callout forge-callout--info">
        <strong>AI hybrid search</strong>
        <p style={{ margin: "0.35rem 0 0" }}>
          Configure embeddings, hybrid weights, and reindex jobs on the dedicated{" "}
          <Link href="/admin/ai-search">AI Search</Link> page or below.
        </p>
      </section>
      <AiSearchSettingsPanel />

      <ApprovalPolicyPanel />

      <section className="forge-card forge-card--panel">
        <strong style={{ fontSize: "0.875rem" }}>About ForgeOps</strong>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem", color: "var(--forge-text-muted)" }}>
          ForgeOps is the operations, merchandising, and governance console for large
          home-improvement commerce catalogs. It provides search tuning, release controls,
          and auditability in one workspace.
        </p>
      </section>

      <section className="forge-callout forge-callout--info">
        <strong>Bootstrap / instance setup</strong>
        <p style={{ margin: "0.35rem 0 0" }}>
          First-run instance configuration is handled via{" "}
          <Link href="/setup">/setup</Link> on fresh deployments. Demo seed marks setup
          complete automatically.
        </p>
      </section>
    </div>
  );
}
