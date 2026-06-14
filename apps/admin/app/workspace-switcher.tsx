"use client";

import type { UserRole, WorkspaceRole } from "@retailer-search/shared-types";
import {
  ALL_WORKSPACE_ROLES,
  canSelectWorkspaceRole,
} from "./lib/workspace-role-access";

export const WORKSPACE_ROLE_STORAGE_KEY = "admin-workspace-role";
export const WORKSPACE_ROLE_CHANGED_EVENT = "admin:workspace-role-changed";

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  merchandiser: "Merchandiser",
  reviewer: "Reviewer",
  approver: "Approver",
  release_manager: "Release manager",
  developer: "Developer",
  admin: "Admin",
};

interface WorkspaceSwitcherProps {
  activeRole: WorkspaceRole;
  effectiveRole: UserRole;
  onRoleChange: (role: WorkspaceRole) => void;
}

export function WorkspaceSwitcher({
  activeRole,
  effectiveRole,
  onRoleChange,
}: WorkspaceSwitcherProps) {
  const handleChange = (role: WorkspaceRole) => {
    if (!canSelectWorkspaceRole(role, effectiveRole)) {
      return;
    }

    onRoleChange(role);
    window.localStorage.setItem(WORKSPACE_ROLE_STORAGE_KEY, role);
    window.dispatchEvent(
      new CustomEvent(WORKSPACE_ROLE_CHANGED_EVENT, { detail: { role } }),
    );
  };

  return (
    <div
      style={{
        padding: "0.75rem",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <p style={{ margin: "0 0 0.5rem", fontSize: 13, color: "#64748b" }}>
        Workspace role
      </p>
      <p style={{ margin: "0 0 0.75rem", fontSize: 12, color: "#94a3b8" }}>
        View-only navigation preview. API access follows your signed-in effective role
        ({effectiveRole.replace("_", " ")}).
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {ALL_WORKSPACE_ROLES.map((role) => {
          const selected = activeRole === role;
          const selectable = canSelectWorkspaceRole(role, effectiveRole);
          return (
            <button
              key={role}
              type="button"
              disabled={!selectable}
              onClick={() => handleChange(role)}
              title={
                selectable
                  ? undefined
                  : `Requires ${ROLE_LABELS[role]} access via standing role or approved JIT elevation`
              }
              style={{
                padding: "0.4rem 0.75rem",
                border: selected ? "1px solid var(--forge-primary)" : "1px solid var(--forge-border-strong)",
                borderRadius: 999,
                background: selected ? "var(--forge-primary)" : "var(--forge-surface)",
                color: selected ? "#fff" : "var(--forge-text-muted)",
                cursor: selectable ? "pointer" : "not-allowed",
                opacity: selectable ? 1 : 0.45,
                fontSize: 12,
                fontWeight: selected ? 600 : 500,
              }}
            >
              {ROLE_LABELS[role]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
