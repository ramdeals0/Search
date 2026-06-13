"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { SearchAnalyticsSummaryDto, WorkspaceRole } from "@retailer-search/shared-types";
import { CurrentUserBadge } from "../components/current-user-badge";
import { WorkspaceSummaryCards } from "../workspace-summary-cards";
import {
  WORKSPACE_ROLE_STORAGE_KEY,
  WorkspaceSwitcher,
} from "../workspace-switcher";
import { ForgeOpsLogo } from "./admin-page-header";
import { AdminNav } from "./admin-nav";

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileNavOpen(false);
    }
  }, [isMobile]);

  return (
    <div className={`forge-shell${isMobile ? " forge-shell--mobile" : ""}`}>
      {!isMobile ? (
        <aside className="forge-sidebar">
          <div className="forge-sidebar__brand">
            <ForgeOpsLogo />
          </div>
          <div className="forge-sidebar__nav">
            <AdminNav mobileOpen onNavigate={() => setMobileNavOpen(false)} />
          </div>
          <div className="forge-sidebar__footer">
            <CurrentUserBadge variant="sidebar" />
          </div>
        </aside>
      ) : null}

      <div className="forge-main">
        <header className="forge-header">
          {isMobile ? (
            <button
              type="button"
              className="forge-btn forge-btn--secondary"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-expanded={mobileNavOpen}
              aria-controls="forge-mobile-nav"
            >
              {mobileNavOpen ? "Close" : "Menu"}
            </button>
          ) : (
            <span className="forge-header__title">Operations Console</span>
          )}
        </header>

        {isMobile && mobileNavOpen ? (
          <div id="forge-mobile-nav" className="forge-mobile-nav">
            <div className="forge-sidebar__brand">
              <ForgeOpsLogo />
            </div>
            <AdminNav mobileOpen={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
            <div className="forge-sidebar__footer">
              <CurrentUserBadge variant="sidebar" />
            </div>
          </div>
        ) : null}

        <main className="forge-content">{children}</main>
      </div>
    </div>
  );
}

export function DashboardOverviewWidgets({
  analytics,
}: {
  analytics: SearchAnalyticsSummaryDto;
}) {
  const [activeRole, setActiveRole] = useState<WorkspaceRole>("merchandiser");

  useEffect(() => {
    const stored = window.localStorage.getItem(
      WORKSPACE_ROLE_STORAGE_KEY,
    ) as WorkspaceRole | null;
    if (
      stored &&
      ["merchandiser", "reviewer", "approver", "release_manager", "admin"].includes(
        stored,
      )
    ) {
      setActiveRole(stored);
    }
  }, []);

  return (
    <div className="forge-page-stack" style={{ marginBottom: "1.25rem" }}>
      <WorkspaceSwitcher activeRole={activeRole} onRoleChange={setActiveRole} />
      <WorkspaceSummaryCards activeRole={activeRole} analytics={analytics} />
    </div>
  );
}
