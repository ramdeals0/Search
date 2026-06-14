"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { WorkspaceRole } from "@retailer-search/shared-types";
import {
  ADMIN_DASHBOARD_LINKS,
  canAccessWorkspace,
} from "./admin-workspaces";
import {
  WORKSPACE_ROLE_CHANGED_EVENT,
  WORKSPACE_ROLE_STORAGE_KEY,
} from "../workspace-switcher";

export function DashboardQuickLinks() {
  const [role, setRole] = useState<WorkspaceRole>("merchandiser");

  useEffect(() => {
    const loadRole = () => {
      const stored = window.localStorage.getItem(
        WORKSPACE_ROLE_STORAGE_KEY,
      ) as WorkspaceRole | null;
      if (
        stored &&
        ["merchandiser", "reviewer", "approver", "release_manager", "admin"].includes(
          stored,
        )
      ) {
        setRole(stored);
      }
    };

    loadRole();
    window.addEventListener(WORKSPACE_ROLE_CHANGED_EVENT, loadRole);
    return () => window.removeEventListener(WORKSPACE_ROLE_CHANGED_EVENT, loadRole);
  }, []);

  const links = useMemo(
    () =>
      ADMIN_DASHBOARD_LINKS.filter((link) =>
        canAccessWorkspace(role, link.allowedRoles),
      ),
    [role],
  );

  return (
    <div className="forge-grid-links">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="forge-quick-link">
          <div className="forge-quick-link__title">{link.label}</div>
          <div className="forge-quick-link__hint">{link.hint}</div>
        </Link>
      ))}
    </div>
  );
}
