"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { WorkspaceRole } from "@retailer-search/shared-types";
import { useWorkspaceRoleState } from "../lib/use-workspace-role";
import { canAccessWorkspace } from "./admin-workspaces";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: ReactNode;
  allowedRoles: WorkspaceRole[] | "all";
}

export interface AdminNavChildLink {
  href: string;
  label: string;
}

export interface AdminNavChildGroup {
  label: string;
  items: AdminNavChildLink[];
}

export interface AdminNavExpandableItem {
  href: string;
  label: string;
  icon: ReactNode;
  allowedRoles: WorkspaceRole[] | "all";
  childGroups: AdminNavChildGroup[];
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
  expandable?: AdminNavExpandableItem;
}

function NavIcon({ children }: { children: ReactNode }) {
  return <span className="forge-nav-link__icon">{children}</span>;
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        allowedRoles: "all",
        icon: (
          <NavIcon>
            <svg {...iconProps}>
              <path d="M2.5 8.5 8 3l5.5 5.5" />
              <path d="M3.5 7.5V13h9V7.5" />
            </svg>
          </NavIcon>
        ),
      },
    ],
  },
  {
    title: "Catalog",
    items: [
      {
        href: "/admin/products",
        label: "Products",
        allowedRoles: "all",
        icon: (
          <NavIcon>
            <svg {...iconProps}>
              <path d="M2.5 4.5h11v9h-11z" />
              <path d="M5.5 7.5h5M5.5 10h3" />
            </svg>
          </NavIcon>
        ),
      },
    ],
  },
  {
    title: "Search & ranking",
    items: [
      {
        href: "/admin/search",
        label: "Search analytics",
        allowedRoles: "all",
        icon: (
          <NavIcon>
            <svg {...iconProps}>
              <circle cx="7" cy="7" r="4.25" />
              <path d="M10.5 10.5 13.5 13.5" />
            </svg>
          </NavIcon>
        ),
      },
      {
        href: "/admin/ai-search",
        label: "AI Search",
        allowedRoles: "all",
        icon: (
          <NavIcon>
            <svg {...iconProps}>
              <path d="M3 11.5 6 5.5 10 9.5 13 3.5" />
              <circle cx="12.5" cy="11.5" r="1.25" />
            </svg>
          </NavIcon>
        ),
      },
      {
        href: "/admin/search/zero-results",
        label: "Zero-results inbox",
        allowedRoles: "all",
        icon: (
          <NavIcon>
            <svg {...iconProps}>
              <path d="M3 8.5h10" />
              <path d="M8 3.5v10" />
            </svg>
          </NavIcon>
        ),
      },
      {
        href: "/admin/experiments",
        label: "Experiments",
        allowedRoles: "all",
        icon: (
          <NavIcon>
            <svg {...iconProps}>
              <path d="M3 12h10" />
              <path d="M5 12V8M8 12V5M11 12V9" />
            </svg>
          </NavIcon>
        ),
      },
    ],
    expandable: {
      href: "/admin/merchandising",
      label: "Merchandising",
      allowedRoles: "all",
      icon: (
        <NavIcon>
          <svg {...iconProps}>
            <path d="M3 12V6l5-3 5 3v6" />
            <path d="M6.5 12V9h3v3" />
          </svg>
        </NavIcon>
      ),
      childGroups: [
        {
          label: "Workspace",
          items: [{ href: "/admin/merchandising", label: "Overview" }],
        },
        {
          label: "Configure",
          items: [
            { href: "/admin/merchandising/rules", label: "Rules" },
            { href: "/admin/merchandising/synonyms", label: "Synonyms" },
            { href: "/admin/merchandising/modules", label: "Content modules" },
            { href: "/admin/merchandising/suggestions", label: "Suggestions" },
          ],
        },
        {
          label: "Environments",
          items: [
            { href: "/admin/merchandising/snapshots", label: "Snapshots" },
            { href: "/admin/merchandising/promotions", label: "Promotions" },
          ],
        },
        {
          label: "Workflows",
          items: [
            { href: "/admin/merchandising/workflows/new-rule", label: "New rule wizard" },
            { href: "/admin/merchandising/workflows/new-promotion", label: "New promotion wizard" },
            { href: "/admin/merchandising/workflows/publish", label: "Publish wizard" },
          ],
        },
      ],
    },
  },
  {
    title: "Governance",
    items: [
      {
        href: "/admin/approvals",
        label: "Approvals",
        allowedRoles: "all",
        icon: (
          <NavIcon>
            <svg {...iconProps}>
              <path d="M4 8.5 6.5 11 12 5" />
              <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
            </svg>
          </NavIcon>
        ),
      },
      {
        href: "/admin/audit",
        label: "Audit trail",
        allowedRoles: "all",
        icon: (
          <NavIcon>
            <svg {...iconProps}>
              <path d="M4 3.5h8v9h-8z" />
              <path d="M6 6.5h4M6 9h4" />
            </svg>
          </NavIcon>
        ),
      },
      {
        href: "/admin/notifications",
        label: "Notifications",
        allowedRoles: "all",
        icon: (
          <NavIcon>
            <svg {...iconProps}>
              <path d="M3.5 6.5a4.5 4.5 0 0 1 9 0v3l1.5 2h-12l1.5-2z" />
              <path d="M6.5 13a1.5 1.5 0 0 0 3 0" />
            </svg>
          </NavIcon>
        ),
      },
    ],
    expandable: {
      href: "/admin/access",
      label: "Access control",
      allowedRoles: "all",
      icon: (
        <NavIcon>
          <svg {...iconProps}>
            <circle cx="8" cy="5.5" r="2" />
            <path d="M3.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
          </svg>
        </NavIcon>
      ),
      childGroups: [
        {
          label: "Overview",
          items: [{ href: "/admin/access", label: "Access home" }],
        },
        {
          label: "Requests & reviews",
          items: [
            { href: "/admin/access/jit", label: "JIT elevation" },
            { href: "/admin/access/requests", label: "Standing requests" },
            { href: "/admin/access/reviews", label: "Access reviews" },
          ],
        },
      ],
    },
  },
  {
    title: "Integrations",
    items: [],
    expandable: {
      href: "/admin/integrations",
      label: "Integrations hub",
      allowedRoles: "all",
      icon: (
        <NavIcon>
          <svg {...iconProps}>
            <path d="M5 8.5h6" />
            <circle cx="4" cy="8.5" r="1.5" />
            <circle cx="12" cy="8.5" r="1.5" />
          </svg>
        </NavIcon>
      ),
      childGroups: [
        {
          label: "Connect",
          items: [{ href: "/admin/integrations", label: "Webhooks & delivery" }],
        },
        {
          label: "API platform",
          items: [
            { href: "/admin/integrations/api-keys", label: "API keys" },
            { href: "/admin/integrations/usage", label: "API usage" },
            { href: "/admin/developer", label: "Developer portal" },
          ],
        },
        {
          label: "Data",
          items: [{ href: "/admin/exports", label: "Export jobs" }],
        },
      ],
    },
  },
  {
    title: "Platform",
    items: [
      {
        href: "/admin/settings",
        label: "Settings",
        allowedRoles: "all",
        icon: (
          <NavIcon>
            <svg {...iconProps}>
              <circle cx="8" cy="8" r="2.25" />
              <path d="M8 2.5v1.2M8 12.3V13.5M13.5 8h-1.2M3.7 8H2.5M11.6 4.4l-.85.85M5.25 10.75l-.85.85M11.6 11.6l-.85-.85M5.25 5.25l-.85-.85" />
            </svg>
          </NavIcon>
        ),
      },
      {
        href: "/admin/platform/catalogs",
        label: "Catalog registry",
        allowedRoles: ["admin"],
        icon: (
          <NavIcon>
            <svg {...iconProps}>
              <path d="M2.5 4.5h11v9h-11z" />
              <path d="M5.5 7.5h5M5.5 10h3" />
            </svg>
          </NavIcon>
        ),
      },
      {
        href: "/admin/platform/plugins",
        label: "Search plugins",
        allowedRoles: ["admin"],
        icon: (
          <NavIcon>
            <svg {...iconProps}>
              <path d="M5 8.5h6" />
              <circle cx="4" cy="8.5" r="1.5" />
              <circle cx="12" cy="8.5" r="1.5" />
            </svg>
          </NavIcon>
        ),
      },
    ],
  },
];

function canAccessItem(item: AdminNavItem | AdminNavExpandableItem, role: WorkspaceRole): boolean {
  return canAccessWorkspace(role, item.allowedRoles);
}

function canAccessChildLink(
  link: AdminNavChildLink,
  expandable: AdminNavExpandableItem,
  role: WorkspaceRole,
): boolean {
  if (link.href === "/admin/integrations/api-keys") {
    return canAccessWorkspace(role, ["admin"]);
  }
  if (link.href === "/admin/integrations/usage") {
    return canAccessWorkspace(role, ["admin", "developer"]);
  }
  if (link.href === "/admin/developer") {
    return canAccessWorkspace(role, ["developer", "admin"]);
  }
  return canAccessItem(expandable, role);
}

function isExpandableRootPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isSubNavActive(pathname: string, href: string, rootHref: string): boolean {
  if (href === rootHref) {
    return pathname === href;
  }
  if (href === "/admin/merchandising/rules") {
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) &&
        !pathname.startsWith("/admin/merchandising/workflows/"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  if (href === "/admin/merchandising" || href === "/admin/access" || href === "/admin/integrations") {
    return isExpandableRootPath(pathname, href);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function flattenChildGroups(expandable: AdminNavExpandableItem): AdminNavChildLink[] {
  return expandable.childGroups.flatMap((group) => group.items);
}

interface AdminNavProps {
  mobileOpen: boolean;
  onNavigate?: () => void;
}

interface ExpandableNavSectionProps {
  expandable: AdminNavExpandableItem;
  pathname: string;
  role: WorkspaceRole;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

function ExpandableNavSection({
  expandable,
  pathname,
  role,
  expanded,
  onToggle,
  onNavigate,
}: ExpandableNavSectionProps) {
  const rootActive = isActivePath(pathname, expandable.href);

  return (
    <li className="forge-nav-expandable">
      <div className="forge-nav-expandable__row">
        <Link
          href={expandable.href}
          onClick={onNavigate}
          className={`forge-nav-link${rootActive ? " forge-nav-link--active" : ""}`}
          aria-current={rootActive ? "page" : undefined}
        >
          {expandable.icon}
          <span className="forge-nav-link__text">{expandable.label}</span>
        </Link>
        <button
          type="button"
          className="forge-nav-expand-btn"
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${expandable.label}` : `Expand ${expandable.label}`}
          onClick={onToggle}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={`forge-nav-expand-btn__chevron${expanded ? " forge-nav-expand-btn__chevron--open" : ""}`}
          >
            <path d="M4 5.5 7 8.5 10 5.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {expanded ? (
        <div className="forge-nav-sublist">
          {expandable.childGroups.map((group) => {
            const visibleItems = group.items.filter((item) =>
              canAccessChildLink(item, expandable, role),
            );
            if (visibleItems.length === 0) {
              return null;
            }

            return (
              <div key={group.label} className="forge-nav-subgroup">
                <div className="forge-nav-subgroup__label">{group.label}</div>
                <ul className="forge-nav-list forge-nav-list--nested">
                  {visibleItems.map((child) => {
                    const childActive = isSubNavActive(pathname, child.href, expandable.href);
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          onClick={onNavigate}
                          className={`forge-nav-link forge-nav-link--child${childActive ? " forge-nav-link--active" : ""}`}
                          aria-current={childActive ? "page" : undefined}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </li>
  );
}

export function AdminNav({ mobileOpen, onNavigate }: AdminNavProps) {
  const pathname = usePathname();
  const { activeRole: role } = useWorkspaceRoleState();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    for (const group of ADMIN_NAV_GROUPS) {
      if (group.expandable && isExpandableRootPath(pathname, group.expandable.href)) {
        setExpandedSections((current) => ({
          ...current,
          [group.expandable!.href]: true,
        }));
      }
    }
  }, [pathname]);

  const visibleGroups = useMemo(
    () =>
      ADMIN_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => canAccessItem(item, role)),
        expandable:
          group.expandable && canAccessItem(group.expandable, role)
            ? {
                ...group.expandable,
                childGroups: group.expandable.childGroups
                  .map((childGroup) => ({
                    ...childGroup,
                    items: childGroup.items.filter((item) =>
                      canAccessChildLink(item, group.expandable!, role),
                    ),
                  }))
                  .filter((childGroup) => childGroup.items.length > 0),
              }
            : undefined,
      })).filter(
        (group) =>
          group.items.length > 0 ||
          (group.expandable && group.expandable.childGroups.length > 0),
      ),
    [role],
  );

  return (
    <nav
      aria-label="Admin navigation"
      className={`forge-nav${mobileOpen ? " forge-nav--mobile-open" : ""}`}
    >
      {visibleGroups.map((group) => (
        <div key={group.title} className="forge-nav-section">
          <div className="forge-nav-section__label">{group.title}</div>
          <ul className="forge-nav-list">
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={`forge-nav-link${active ? " forge-nav-link--active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.icon}
                    <span className="forge-nav-link__text">{item.label}</span>
                  </Link>
                </li>
              );
            })}
            {group.expandable ? (
              <ExpandableNavSection
                expandable={group.expandable}
                pathname={pathname}
                role={role}
                expanded={expandedSections[group.expandable.href] ?? false}
                onToggle={() =>
                  setExpandedSections((current) => ({
                    ...current,
                    [group.expandable!.href]: !(current[group.expandable!.href] ?? false),
                  }))
                }
                onNavigate={onNavigate}
              />
            ) : null}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function getAdminNavChildLinks(): AdminNavChildLink[] {
  return ADMIN_NAV_GROUPS.flatMap((group) =>
    group.expandable ? flattenChildGroups(group.expandable) : [],
  );
}
