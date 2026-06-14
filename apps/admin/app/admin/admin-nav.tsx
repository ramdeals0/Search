"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { WorkspaceRole } from "@retailer-search/shared-types";
import {
  WORKSPACE_ROLE_CHANGED_EVENT,
  WORKSPACE_ROLE_STORAGE_KEY,
} from "../workspace-switcher";
import { canAccessWorkspace } from "./admin-workspaces";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: ReactNode;
  allowedRoles: WorkspaceRole[] | "all";
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
  expandable?: AdminNavExpandableItem;
}

export interface AdminNavExpandableItem {
  href: string;
  label: string;
  icon: ReactNode;
  allowedRoles: WorkspaceRole[] | "all";
  children: Array<{ href: string; label: string }>;
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
      {
        href: "/admin/search",
        label: "Search",
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
      children: [
        { href: "/admin/merchandising", label: "Overview" },
        { href: "/admin/merchandising/rules", label: "Rules" },
        { href: "/admin/merchandising/workflows/new-rule", label: "Guided new rule" },
        { href: "/admin/merchandising/snapshots", label: "Snapshots" },
        { href: "/admin/merchandising/promotions", label: "Promotions" },
        { href: "/admin/merchandising/workflows/new-promotion", label: "Guided promotion" },
        { href: "/admin/merchandising/workflows/publish", label: "Guided publish" },
        { href: "/admin/merchandising/suggestions", label: "Suggestions" },
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
        label: "Audit",
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
      label: "Access",
      allowedRoles: "all",
      icon: (
        <NavIcon>
          <svg {...iconProps}>
            <circle cx="8" cy="5.5" r="2" />
            <path d="M3.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
          </svg>
        </NavIcon>
      ),
      children: [
        { href: "/admin/access", label: "Overview" },
        { href: "/admin/access/jit", label: "JIT elevation" },
        { href: "/admin/access/requests", label: "Standing requests" },
        { href: "/admin/access/reviews", label: "Access reviews" },
      ],
    },
  },
  {
    title: "Operations",
    items: [
      {
        href: "/admin/exports",
        label: "Exports",
        allowedRoles: "all",
        icon: (
          <NavIcon>
            <svg {...iconProps}>
              <path d="M8 3.5v7" />
              <path d="M5.5 8 8 10.5 10.5 8" />
              <path d="M3.5 12.5h9" />
            </svg>
          </NavIcon>
        ),
      },
      {
        href: "/admin/integrations",
        label: "Integrations",
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
      },
      {
        href: "/admin/integrations/api-keys",
        label: "API keys",
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
    ],
  },
];

const UTILITY_NAV_ITEMS: AdminNavItem[] = [
  {
    href: "/login",
    label: "Sign out",
    allowedRoles: "all",
    icon: (
      <NavIcon>
        <svg {...iconProps}>
          <path d="M6 8H13" />
          <path d="M10.5 5.5 13 8l-2.5 2.5" />
          <path d="M3.5 3.5v9" />
        </svg>
      </NavIcon>
    ),
  },
];

function canAccessItem(item: AdminNavItem, role: WorkspaceRole): boolean {
  return canAccessWorkspace(role, item.allowedRoles);
}

function isExpandableRootPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isSubNavActive(
  pathname: string,
  href: string,
  rootHref: string,
): boolean {
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
  if (href === "/login") {
    return false;
  }
  if (href === "/admin/merchandising" || href === "/admin/access") {
    return isExpandableRootPath(pathname, href);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface AdminNavProps {
  mobileOpen: boolean;
  onNavigate?: () => void;
  variant?: "primary" | "utility";
}

export function AdminNav({
  mobileOpen,
  onNavigate,
  variant = "primary",
}: AdminNavProps) {
  const pathname = usePathname();
  const [role, setRole] = useState<WorkspaceRole>("merchandiser");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "/admin/merchandising": true,
    "/admin/access": true,
  });

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

  useEffect(() => {
    for (const group of ADMIN_NAV_GROUPS) {
      if (
        group.expandable &&
        isExpandableRootPath(pathname, group.expandable.href)
      ) {
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
            ? group.expandable
            : undefined,
      })).filter((group) => group.items.length > 0 || group.expandable),
    [role],
  );

  const utilityItems = useMemo(
    () => UTILITY_NAV_ITEMS.filter((item) => canAccessItem(item, role)),
    [role],
  );

  if (variant === "utility") {
    return (
      <nav aria-label="Utility navigation">
        <ul className="forge-nav-list">
          {utilityItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={`forge-nav-link${isActivePath(pathname, item.href) ? " forge-nav-link--active" : ""}`}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Admin navigation" style={{ display: mobileOpen ? "block" : undefined }}>
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
                    {item.label}
                  </Link>
                </li>
              );
            })}
            {group.expandable ? (
              <li>
                <div style={{ display: "grid", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "stretch", gap: 2 }}>
                    <Link
                      href={group.expandable.href}
                      onClick={onNavigate}
                      className={`forge-nav-link${isActivePath(pathname, group.expandable.href) ? " forge-nav-link--active" : ""}`}
                      style={{ flex: 1 }}
                      aria-current={
                        isActivePath(pathname, group.expandable.href) ? "page" : undefined
                      }
                    >
                      {group.expandable.icon}
                      {group.expandable.label}
                    </Link>
                    <button
                      type="button"
                      aria-expanded={expandedSections[group.expandable.href] ?? true}
                      aria-label={
                        expandedSections[group.expandable.href] ?? true
                          ? `Collapse ${group.expandable.label} navigation`
                          : `Expand ${group.expandable.label} navigation`
                      }
                      onClick={() =>
                        setExpandedSections((current) => ({
                          ...current,
                          [group.expandable!.href]: !(current[group.expandable!.href] ?? true),
                        }))
                      }
                      className="forge-nav-link"
                      style={{
                        width: "2rem",
                        justifyContent: "center",
                        paddingInline: 0,
                        cursor: "pointer",
                      }}
                    >
                      {(expandedSections[group.expandable.href] ?? true) ? "▾" : "▸"}
                    </button>
                  </div>
                  {(expandedSections[group.expandable.href] ?? true) ? (
                    <ul
                      className="forge-nav-list"
                      style={{ paddingLeft: "1.35rem", marginTop: 2 }}
                    >
                      {group.expandable.children.map((child) => {
                        const childActive = isSubNavActive(
                          pathname,
                          child.href,
                          group.expandable!.href,
                        );
                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={onNavigate}
                              className={`forge-nav-link${childActive ? " forge-nav-link--active" : ""}`}
                              style={{ fontSize: "0.8125rem", paddingBlock: "0.4rem" }}
                              aria-current={childActive ? "page" : undefined}
                            >
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              </li>
            ) : null}
          </ul>
        </div>
      ))}
    </nav>
  );
}
