"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useEffect, useMemo, useState } from "react";
import type {
  MerchandisingRule,
  SavedViewDto,
  SearchAnalyticsSummaryDto,
  WorkspacePresetDto,
  WorkspaceRole,
  WorkspaceStateDto,
} from "@retailer-search/shared-types";
import { ApprovalPanel } from "./approval-panel";
import { ApprovalPolicyPanel } from "./approval-policy-panel";
import { ApprovalSlaPanel } from "./approval-sla-panel";
import { ActiveConfigBadge } from "./active-config-badge";
import { AnalyticsPanel } from "./analytics-panel";
import { AuditLogPanel } from "./audit-log-panel";
import { DecisionPanel } from "./decision-panel";
import { DelegationPanel } from "./delegation-panel";
import { EnvironmentPanel } from "./environment-panel";
import { EnvironmentSwitcher } from "./environment-switcher";
import { ExperimentRunView } from "./experiment-run-view";
import { ExperimentsPanel } from "./experiments-panel";
import { ExceptionQueuePanel } from "./exception-queue-panel";
import { NotificationInboxPanel } from "./notification-inbox-panel";
import { PromotionPanel } from "./promotion-panel";
import { QueryPreview } from "./query-preview";
import { QuerySetEditor } from "./query-set-editor";
import { ReviewerManagementPanel } from "./admin/approvals/components/reviewer-management-panel";
import { RulesTable } from "./rules-table";
import { SavedViewsPanel } from "./saved-views-panel";
import { ScorecardPanel } from "./scorecard-panel";
import { SnapshotsPanel } from "./snapshots-panel";
import { SuggestionsPanel } from "./suggestions-panel";
import {
  WorkspaceSwitcher,
  WORKSPACE_ROLE_STORAGE_KEY,
} from "./workspace-switcher";
import { WorkspaceSummaryCards } from "./workspace-summary-cards";

const ADMIN_SECTION_ORDER = [
  "environment",
  "analytics",
  "suggestions",
  "query-preview",
  "rules",
  "snapshots",
  "query-sets",
  "experiments",
  "workflow-guide",
  "experiment-run",
  "scorecard",
  "decision",
  "reviewers",
  "approval-policy",
  "delegation",
  "exceptions",
  "approval-sla",
  "notifications",
  "approvals",
  "promotions",
  "audit-log",
] as const;

interface RoleDashboardProps {
  initialRules: MerchandisingRule[];
  initialAnalytics: SearchAnalyticsSummaryDto;
  loadError: string | null;
}

export function RoleDashboard({
  initialRules,
  initialAnalytics,
  loadError,
}: RoleDashboardProps) {
  const [activeRole, setActiveRole] = useState<WorkspaceRole>("merchandiser");
  const [presets, setPresets] = useState<WorkspacePresetDto[]>([]);
  const [selectedView, setSelectedView] = useState<SavedViewDto | null>(null);

  useEffect(() => {
    const storedRole = window.localStorage.getItem(
      WORKSPACE_ROLE_STORAGE_KEY,
    ) as WorkspaceRole | null;
    if (
      storedRole &&
      ["merchandiser", "reviewer", "approver", "release_manager", "admin"].includes(
        storedRole,
      )
    ) {
      setActiveRole(storedRole);
    }
  }, []);

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const response = await fetch(
          `${getSearchApiUrl()}/api/v1/admin/workspaces?activeRole=${encodeURIComponent(activeRole)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as WorkspaceStateDto;
        setPresets(body.presets);
      } catch {
        setPresets([]);
      }
    };

    void loadWorkspace();
  }, [activeRole]);

  const activePreset = presets.find((preset) => preset.role === activeRole);

  const currentFilters: Record<string, unknown> = useMemo(() => {
    const base = activePreset?.defaultFilters ?? { role: activeRole };
    if (selectedView) {
      return { ...base, ...selectedView.filters, role: activeRole };
    }
    return { ...base, role: activeRole };
  }, [activePreset, activeRole, selectedView]);

  const visibleSectionOrder = useMemo(() => {
    if (activeRole === "admin") {
      return [...ADMIN_SECTION_ORDER];
    }

    return activePreset?.visibleSections ?? [];
  }, [activeRole, activePreset]);

  const isSectionVisible = (sectionId: string): boolean => {
    if (activeRole === "admin") {
      return true;
    }

    return activePreset?.visibleSections.includes(sectionId) ?? false;
  };

  const renderSection = (sectionId: string) => {
    if (!isSectionVisible(sectionId)) {
      return null;
    }

    const emphasized =
      selectedView?.filters.section === sectionId ||
      currentFilters.section === sectionId;

    const content = renderSectionContent(sectionId, initialRules, initialAnalytics);
    if (!content) {
      return null;
    }

    return (
      <div
        key={sectionId}
        id={sectionId}
        style={
          emphasized
            ? {
                boxShadow: "0 0 0 2px #93c5fd",
                borderRadius: 8,
              }
            : undefined
        }
      >
        {content}
      </div>
    );
  };

  const handleRoleChange = (role: WorkspaceRole) => {
    setActiveRole(role);
    setSelectedView(null);
  };

  return (
    <>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: "0 0 0.35rem" }}>Merchandising Admin</h1>
        <p style={{ margin: 0, color: "#64748b" }}>
          Role-based workspaces for merchandising, review, approval, release, and
          admin operations.
        </p>
        <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.75rem" }}>
          <EnvironmentSwitcher />
          <ActiveConfigBadge />
        </div>
      </header>

      {loadError && (
        <p
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: 8,
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 14,
          }}
        >
          {loadError}. Make sure search-api is running on {getSearchApiUrl()}.
        </p>
      )}

      <div style={{ display: "grid", gap: "1rem", marginBottom: "1.25rem" }}>
        <WorkspaceSwitcher activeRole={activeRole} onRoleChange={handleRoleChange} />
        <WorkspaceSummaryCards activeRole={activeRole} analytics={initialAnalytics} />
        <SavedViewsPanel
          activeRole={activeRole}
          selectedViewId={selectedView?.id ?? null}
          onSelectView={setSelectedView}
          currentFilters={currentFilters}
        />
        {activePreset && (
          <p
            style={{
              margin: 0,
              padding: "0.65rem 0.85rem",
              borderRadius: 8,
              background: "#eff6ff",
              color: "#1e3a8a",
              fontSize: 13,
            }}
          >
            <strong>{activePreset.title}:</strong> {activePreset.description}
            {selectedView ? ` · Applied view '${selectedView.name}'` : ""}
          </p>
        )}
      </div>

      <div style={{ display: "grid", gap: "1.25rem" }}>
        {visibleSectionOrder.map((sectionId) => renderSection(sectionId))}
      </div>
    </>
  );
}

function renderSectionContent(
  sectionId: string,
  initialRules: MerchandisingRule[],
  initialAnalytics: SearchAnalyticsSummaryDto,
) {
  switch (sectionId) {
    case "environment":
      return <EnvironmentPanel />;
    case "analytics":
      return <AnalyticsPanel analytics={initialAnalytics} />;
    case "suggestions":
      return <SuggestionsPanel />;
    case "query-preview":
      return (
        <div id="query-preview-section">
          <QueryPreview />
        </div>
      );
    case "rules":
      return <RulesTable initialRules={initialRules} />;
    case "snapshots":
      return <SnapshotsPanel />;
    case "query-sets":
      return <QuerySetEditor />;
    case "experiments":
      return <ExperimentsPanel />;
    case "workflow-guide":
      return (
        <div
          style={{
            padding: "0.85rem 1rem",
            border: "1px dashed #cbd5e1",
            borderRadius: 8,
            background: "#f8fafc",
            fontSize: 13,
            color: "#475569",
          }}
        >
          <strong>Release workflow:</strong> staging edits → experiment → scorecard
          → approval → execute to live → monitor SLA and exceptions.
        </div>
      );
    case "experiment-run":
      return <ExperimentRunView />;
    case "scorecard":
      return <ScorecardPanel />;
    case "decision":
      return <DecisionPanel />;
    case "reviewers":
      return <ReviewerManagementPanel />;
    case "approval-policy":
      return <ApprovalPolicyPanel />;
    case "delegation":
      return <DelegationPanel />;
    case "exceptions":
      return <ExceptionQueuePanel />;
    case "approval-sla":
      return <ApprovalSlaPanel />;
    case "notifications":
      return <NotificationInboxPanel />;
    case "approvals":
      return <ApprovalPanel />;
    case "promotions":
      return <PromotionPanel />;
    case "active-config":
      return (
        <section
          style={{
            padding: "0.85rem",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            background: "#fff",
            fontSize: 13,
            color: "#475569",
          }}
        >
          <strong>Live active configuration</strong>
          <p style={{ margin: "0.35rem 0 0" }}>
            See the live snapshot badge in the header. Use promotions and snapshots
            below to manage rollback and release candidates.
          </p>
          <div style={{ marginTop: "0.5rem" }}>
            <ActiveConfigBadge />
          </div>
        </section>
      );
    case "audit-log":
      return <AuditLogPanel />;
    default:
      return null;
  }
}
