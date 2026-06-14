"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ADMIN_DASHBOARD_LINKS,
  canAccessWorkspace,
} from "./admin-workspaces";
import { useWorkspaceRoleState } from "../lib/use-workspace-role";

export function DashboardQuickLinks() {
  const { activeRole: role } = useWorkspaceRoleState();

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
