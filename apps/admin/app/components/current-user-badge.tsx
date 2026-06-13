"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { CurrentUserResponseDto } from "@retailer-search/shared-types";
import {
  ACCESS_GOVERNANCE_CHANGED_EVENT,
} from "../access-request-panel";
import { AUTH_TOKEN_STORAGE_KEY, clearAuthSession, persistAuthSession } from "../auth-session";
import { JIT_ACCESS_CHANGED_EVENT } from "../jit-access-panel";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
      : null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface CurrentUserBadgeProps {
  onRequestRoleChange?: () => void;
  variant?: "header" | "sidebar";
}

export function CurrentUserBadge({
  onRequestRoleChange,
  variant = "header",
}: CurrentUserBadgeProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUserResponseDto | null>(
    null,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSidebar = variant === "sidebar";

  const loadCurrentUser = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${SEARCH_API_URL}/api/v1/auth/me`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      });

      if (!response.ok) {
        setCurrentUser({ authenticated: false });
        return;
      }

      setCurrentUser((await response.json()) as CurrentUserResponseDto);
    } catch (loadError) {
      setCurrentUser({ authenticated: false });
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load current user",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCurrentUser();
    const interval = window.setInterval(() => {
      void loadCurrentUser();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [loadCurrentUser]);

  useEffect(() => {
    const handler = () => {
      void loadCurrentUser();
    };
    window.addEventListener(ACCESS_GOVERNANCE_CHANGED_EVENT, handler);
    window.addEventListener(JIT_ACCESS_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(ACCESS_GOVERNANCE_CHANGED_EVENT, handler);
      window.removeEventListener(JIT_ACCESS_CHANGED_EVENT, handler);
    };
  }, [loadCurrentUser]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setSigningIn(true);
    setError(null);

    try {
      const response = await fetch(`${SEARCH_API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const body = (await response.json()) as {
        success?: boolean;
        session?: { token: string };
        message?: string;
      };

      if (!response.ok || !body.success || !body.session?.token) {
        throw new Error(body.message ?? "Login failed");
      }

      persistAuthSession(body.session.token);
      setPassword("");
      window.dispatchEvent(new CustomEvent(ACCESS_GOVERNANCE_CHANGED_EVENT));
      window.dispatchEvent(new CustomEvent(JIT_ACCESS_CHANGED_EVENT));
      await loadCurrentUser();
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Login failed");
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    setError(null);

    try {
      await fetch(`${SEARCH_API_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
    } catch {
      // Logout is best-effort for MVP token storage.
    } finally {
      clearAuthSession();
      setCurrentUser({ authenticated: false });
      setSigningOut(false);
      window.dispatchEvent(new CustomEvent(ACCESS_GOVERNANCE_CHANGED_EVENT));
      window.dispatchEvent(new CustomEvent(JIT_ACCESS_CHANGED_EVENT));
      router.push("/login");
      router.refresh();
    }
  };

  const isElevated =
    currentUser?.activePrivilege?.source === "jit" &&
    currentUser.effectiveRole !== currentUser.standingRole;

  if (loading) {
    return (
      <div className={isSidebar ? "forge-account-panel" : undefined}
        style={
          isSidebar
            ? undefined
            : {
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "0.75rem 1rem",
                background: "#fff",
                fontSize: 13,
                color: "#64748b",
              }
        }
      >
        <span style={{ fontSize: isSidebar ? 13 : undefined, color: "var(--forge-text-subtle)" }}>
          Checking session…
        </span>
      </div>
    );
  }

  if (!currentUser?.authenticated || !currentUser.user) {
    if (isSidebar) {
      return (
        <div className="forge-account-panel">
          <div className="forge-account-panel__name">Sign in required</div>
          <p style={{ margin: "0.25rem 0 0", fontSize: 12, color: "var(--forge-text-subtle)" }}>
            Use the login page to start a session.
          </p>
        </div>
      );
    }

    return (
      <div
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          padding: "1rem",
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Admin sign in
        </div>
        <p style={{ marginTop: 0, fontSize: 12, color: "#64748b" }}>
          MVP session token stored in localStorage. Use a seeded demo account.
        </p>
        {error ? (
          <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 0 }}>{error}</p>
        ) : null}
        <form
          onSubmit={signIn}
          style={{ display: "grid", gap: 8, maxWidth: 360 }}
        >
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
            className="forge-input"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
            className="forge-input"
          />
          <button
            type="submit"
            disabled={signingIn}
            className="forge-btn forge-btn--primary"
          >
            {signingIn ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  const requestJit = () => {
    if (onRequestRoleChange) {
      onRequestRoleChange();
      return;
    }
    document
      .getElementById("jit-access")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const requestStandingRoleChange = () => {
    document
      .getElementById("access-requests")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isSidebar) {
    return (
      <div
        className={`forge-account-panel${isElevated ? " forge-account-panel--elevated" : ""}`}
      >
        <div>
          <div className="forge-account-panel__name">{currentUser.user.name}</div>
          <div className="forge-account-panel__email">{currentUser.user.email}</div>
          <div className="forge-account-panel__meta">
            <div>
              Standing role:{" "}
              <strong>{currentUser.standingRole ?? currentUser.user.role}</strong>
            </div>
            <div>
              Effective role:{" "}
              <strong style={{ color: isElevated ? "#b45309" : undefined }}>
                {currentUser.effectiveRole ?? currentUser.user.role}
              </strong>
              {isElevated ? (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#b45309",
                    textTransform: "uppercase",
                  }}
                >
                  Temporary
                </span>
              ) : null}
            </div>
            {currentUser.activePrivilege?.expiresAt ? (
              <div style={{ color: "#b45309", marginTop: 4 }}>
                Elevated access expires{" "}
                {new Date(currentUser.activePrivilege.expiresAt).toLocaleString()}
              </div>
            ) : null}
          </div>
        </div>

        <div className="forge-account-panel__actions">
          <button
            type="button"
            onClick={requestJit}
            className="forge-btn forge-btn--secondary"
          >
            Request JIT access
          </button>
          <button
            type="button"
            onClick={requestStandingRoleChange}
            className="forge-btn forge-btn--secondary"
          >
            Standing role change
          </button>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => void signOut()}
            className="forge-btn forge-btn--ghost"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        border: isElevated ? "1px solid #f59e0b" : "1px solid #cbd5e1",
        borderRadius: 8,
        padding: "0.75rem 1rem",
        background: isElevated ? "#fffbeb" : "#fff",
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{currentUser.user.name}</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>{currentUser.user.email}</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>
          Standing role: <strong>{currentUser.standingRole ?? currentUser.user.role}</strong>
        </div>
        <div style={{ fontSize: 12, marginTop: 2 }}>
          Effective role:{" "}
          <strong style={{ color: isElevated ? "#b45309" : "var(--forge-primary)" }}>
            {currentUser.effectiveRole ?? currentUser.user.role}
          </strong>
          {isElevated ? (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                fontWeight: 700,
                color: "#b45309",
                textTransform: "uppercase",
              }}
            >
              Temporary
            </span>
          ) : null}
        </div>
        {currentUser.activePrivilege?.expiresAt ? (
          <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>
            Elevated access expires{" "}
            {new Date(currentUser.activePrivilege.expiresAt).toLocaleString()}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={requestJit} className="forge-btn forge-btn--secondary">
          Request JIT access
        </button>
        <button
          type="button"
          onClick={requestStandingRoleChange}
          className="forge-btn forge-btn--secondary"
        >
          Standing role change
        </button>
        <button
          type="button"
          disabled={signingOut}
          onClick={() => void signOut()}
          className="forge-btn forge-btn--ghost"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
