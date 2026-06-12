"use client";

import type { WorkspaceRole } from "@retailer-search/shared-types";

export const WORKSPACE_ROLE_STORAGE_KEY = "admin-workspace-role";
export const WORKSPACE_ROLE_CHANGED_EVENT = "admin:workspace-role-changed";

const ROLES: { id: WorkspaceRole; label: string }[] = [
  { id: "merchandiser", label: "Merchandiser" },
  { id: "reviewer", label: "Reviewer" },
  { id: "approver", label: "Approver" },
  { id: "release_manager", label: "Release manager" },
  { id: "admin", label: "Admin" },
];

interface WorkspaceSwitcherProps {
  activeRole: WorkspaceRole;
  onRoleChange: (role: WorkspaceRole) => void;
}

export function WorkspaceSwitcher({
  activeRole,
  onRoleChange,
}: WorkspaceSwitcherProps) {
  const handleChange = (role: WorkspaceRole) => {
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {ROLES.map((role) => {
          const selected = activeRole === role.id;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => handleChange(role.id)}
              style={{
                padding: "0.4rem 0.75rem",
                border: selected ? "1px solid #0f172a" : "1px solid #cbd5e1",
                borderRadius: 999,
                background: selected ? "#0f172a" : "#fff",
                color: selected ? "#fff" : "#334155",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: selected ? 600 : 500,
              }}
            >
              {role.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
