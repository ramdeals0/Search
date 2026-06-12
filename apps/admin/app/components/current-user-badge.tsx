"use client";

import { useCallback, useEffect, useState } from "react";
import type { CurrentUserResponseDto } from "@retailer-search/shared-types";
import {
  ACCESS_GOVERNANCE_CHANGED_EVENT,
  AUTH_TOKEN_STORAGE_KEY,
} from "../access-request-panel";
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
}

export function CurrentUserBadge({ onRequestRoleChange }: CurrentUserBadgeProps) {
  const [currentUser, setCurrentUser] = useState<CurrentUserResponseDto | null>(
    null,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, body.session.token);
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
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      setCurrentUser({ authenticated: false });
      setSigningOut(false);
      window.dispatchEvent(new CustomEvent(ACCESS_GOVERNANCE_CHANGED_EVENT));
      window.dispatchEvent(new CustomEvent(JIT_ACCESS_CHANGED_EVENT));
    }
  };

  const isElevated =
    currentUser?.activePrivilege?.source === "jit" &&
    currentUser.effectiveRole !== currentUser.standingRole;

  if (loading) {
    return (
      <div
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          padding: "0.75rem 1rem",
          background: "#fff",
          fontSize: 13,
          color: "#64748b",
        }}
      >
        Checking session…
      </div>
    );
  }

  if (!currentUser?.authenticated || !currentUser.user) {
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
            style={{
              padding: "0.45rem 0.6rem",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              fontSize: 13,
            }}
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
            style={{
              padding: "0.45rem 0.6rem",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              fontSize: 13,
            }}
          />
          <button
            type="submit"
            disabled={signingIn}
            style={{
              width: "fit-content",
              padding: "0.45rem 0.85rem",
              borderRadius: 6,
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#fff",
              cursor: signingIn ? "wait" : "pointer",
              fontSize: 13,
            }}
          >
            {signingIn ? "Signing in…" : "Sign in"}
          </button>
        </form>
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
          <strong style={{ color: isElevated ? "#b45309" : "#0f172a" }}>
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
        <button
          type="button"
          onClick={() => {
            if (onRequestRoleChange) {
              onRequestRoleChange();
              return;
            }

            document
              .getElementById("jit-access")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          style={{
            padding: "0.4rem 0.75rem",
            borderRadius: 6,
            border: "1px solid #b45309",
            background: "#fffbeb",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Request JIT access
        </button>
        <button
          type="button"
          onClick={() => {
            document
              .getElementById("access-requests")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          style={{
            padding: "0.4rem 0.75rem",
            borderRadius: 6,
            border: "1px solid #2563eb",
            background: "#eff6ff",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Standing role change
        </button>
        <button
          type="button"
          disabled={signingOut}
          onClick={() => void signOut()}
          style={{
            padding: "0.4rem 0.75rem",
            borderRadius: 6,
            border: "1px solid #64748b",
            background: "#fff",
            cursor: signingOut ? "wait" : "pointer",
            fontSize: 12,
          }}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
