"use client";

import type { WorkspaceRole } from "@retailer-search/shared-types";
import { useCallback, useEffect, useState } from "react";
import type { CurrentUserResponseDto, UserRole } from "@retailer-search/shared-types";
import { persistCsrfToken } from "../auth-session";
import { getAuthHeaders } from "./auth-headers";
import { getSearchApiUrl } from "./search-api-url";
import {
  ALL_WORKSPACE_ROLES,
  canSelectWorkspaceRole,
  clampWorkspaceRole,
  resolveStoredWorkspaceRole,
} from "./workspace-role-access";
import {
  WORKSPACE_ROLE_CHANGED_EVENT,
  WORKSPACE_ROLE_STORAGE_KEY,
} from "../workspace-switcher";

export function useEffectiveRole(): UserRole {
  const [effectiveRole, setEffectiveRole] = useState<UserRole>("merchandiser");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`${getSearchApiUrl()}/api/v1/auth/me`, {
          headers: getAuthHeaders(),
          cache: "no-store",
        });
        if (!response.ok || cancelled) {
          return;
        }

        const body = (await response.json()) as CurrentUserResponseDto;
        if (!body.authenticated || !body.user || cancelled) {
          return;
        }

        setEffectiveRole(body.effectiveRole ?? body.user.role);
        if (body.csrfToken) {
          persistCsrfToken(body.csrfToken);
        }
      } catch {
        // Keep default merchandiser when auth context is unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return effectiveRole;
}

export function useWorkspaceRoleState() {
  const effectiveRole = useEffectiveRole();
  const [activeRole, setActiveRole] = useState<WorkspaceRole>("merchandiser");

  const applyRole = useCallback(
    (role: WorkspaceRole) => {
      const nextRole = canSelectWorkspaceRole(role, effectiveRole)
        ? role
        : clampWorkspaceRole(role, effectiveRole);
      setActiveRole(nextRole);
      window.localStorage.setItem(WORKSPACE_ROLE_STORAGE_KEY, nextRole);
      window.dispatchEvent(
        new CustomEvent(WORKSPACE_ROLE_CHANGED_EVENT, { detail: { role: nextRole } }),
      );
    },
    [effectiveRole],
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(WORKSPACE_ROLE_STORAGE_KEY);
    applyRole(resolveStoredWorkspaceRole(stored, effectiveRole));
  }, [applyRole, effectiveRole]);

  useEffect(() => {
    const syncFromStorage = () => {
      const stored = window.localStorage.getItem(WORKSPACE_ROLE_STORAGE_KEY);
      setActiveRole(resolveStoredWorkspaceRole(stored, effectiveRole));
    };

    window.addEventListener(WORKSPACE_ROLE_CHANGED_EVENT, syncFromStorage);
    return () =>
      window.removeEventListener(WORKSPACE_ROLE_CHANGED_EVENT, syncFromStorage);
  }, [effectiveRole]);

  return {
    activeRole,
    effectiveRole,
    selectableRoles: ALL_WORKSPACE_ROLES.filter((role) =>
      canSelectWorkspaceRole(role, effectiveRole),
    ),
    setActiveRole: applyRole,
  };
}
