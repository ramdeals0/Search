import type { WorkspaceRole } from "@retailer-search/shared-types";

export interface AdminWorkspaceLink {
  href: string;
  label: string;
  hint: string;
  allowedRoles: WorkspaceRole[] | "all";
}

export function canAccessWorkspace(
  role: WorkspaceRole,
  allowedRoles: WorkspaceRole[] | "all",
): boolean {
  if (allowedRoles === "all") {
    return true;
  }
  if (role === "admin") {
    return true;
  }
  return allowedRoles.includes(role);
}

/** Primary workspaces shown on the dashboard quick-links grid. */
export const ADMIN_DASHBOARD_LINKS: AdminWorkspaceLink[] = [
  {
    href: "/admin/products",
    label: "Products",
    hint: "Catalog lookup and SKU context",
    allowedRoles: "all",
  },
  {
    href: "/admin/search",
    label: "Search analytics",
    hint: "Queries, zero-results, performance",
    allowedRoles: "all",
  },
  {
    href: "/admin/search/zero-results",
    label: "Zero-results inbox",
    hint: "Rule drafts for failed queries",
    allowedRoles: "all",
  },
  {
    href: "/admin/merchandising",
    label: "Merchandising",
    hint: "Rules, boosts, promotions",
    allowedRoles: "all",
  },
  {
    href: "/admin/experiments",
    label: "Experiments",
    hint: "A/B configs and scorecards",
    allowedRoles: "all",
  },
  {
    href: "/admin/approvals",
    label: "Approvals",
    hint: "Pending release approvals",
    allowedRoles: "all",
  },
  {
    href: "/admin/access",
    label: "Access",
    hint: "JIT, standing requests, reviews",
    allowedRoles: "all",
  },
  {
    href: "/admin/audit",
    label: "Audit",
    hint: "Trail and security timeline",
    allowedRoles: "all",
  },
  {
    href: "/admin/notifications",
    label: "Notifications",
    hint: "Inbox and alerts",
    allowedRoles: "all",
  },
  {
    href: "/admin/exports",
    label: "Exports",
    hint: "Export jobs and downloads",
    allowedRoles: "all",
  },
  {
    href: "/admin/integrations",
    label: "Integrations",
    hint: "Webhooks and delivery logs",
    allowedRoles: "all",
  },
  {
    href: "/admin/integrations/api-keys",
    label: "API keys",
    hint: "Scoped keys for search and browse",
    allowedRoles: ["admin"],
  },
  {
    href: "/admin/settings",
    label: "Settings",
    hint: "Platform and environment defaults",
    allowedRoles: "all",
  },
];
