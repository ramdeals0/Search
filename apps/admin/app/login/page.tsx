"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BootstrapStateDto, LoginResponseDto } from "@retailer-search/shared-types";
import {
  AUTH_TOKEN_COOKIE_NAME,
  AUTH_TOKEN_STORAGE_KEY,
  persistAuthSession,
} from "../auth-session";
import { ForgeOpsLogo } from "../admin/admin-page-header";
import "../globals.css";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [setupStatus, setSetupStatus] = useState<BootstrapStateDto | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    setNextPath(next);

    const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const hasCookie = document.cookie.includes(`${AUTH_TOKEN_COOKIE_NAME}=`);
    if (storedToken && !hasCookie) {
      persistAuthSession(storedToken);
      router.replace(next?.startsWith("/admin") ? next : "/admin");
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`${SEARCH_API_URL}/api/v1/setup/status`, {
          cache: "no-store",
        });
        if (response.ok) {
          setSetupStatus((await response.json()) as BootstrapStateDto);
        }
      } catch {
        setSetupStatus(null);
      } finally {
        setLoadingSetup(false);
      }
    })();
  }, []);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${SEARCH_API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const body = (await response.json()) as LoginResponseDto & {
        details?: { reason?: string };
      };

      if (response.status === 423 || body.details?.reason === "setup_required") {
        setError("This instance requires initial setup before sign-in.");
        return;
      }

      if (!response.ok || !body.success || !body.session?.token) {
        throw new Error(body.message ?? "Login failed");
      }

      persistAuthSession(body.session.token);
      router.push(nextPath?.startsWith("/admin") ? nextPath : "/admin");
      router.refresh();
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingSetup) {
    return (
      <div className="forge-auth-page">
        <div className="forge-auth-card">
          <ForgeOpsLogo />
          <p style={{ marginTop: "1rem", color: "var(--forge-text-subtle)", fontSize: 14 }}>
            Checking instance status…
          </p>
        </div>
      </div>
    );
  }

  if (setupStatus?.setupRequired) {
    return (
      <div className="forge-auth-page">
        <div className="forge-auth-card">
          <div className="forge-auth-card__header">
            <ForgeOpsLogo />
            <h1 className="forge-auth-card__title">Sign in to ForgeOps</h1>
            <p className="forge-auth-card__subtitle">
              Initial setup is required before the operations console is available.
            </p>
          </div>
          <div
            className="forge-callout"
            style={{
              background: "var(--forge-warning-bg)",
              borderColor: "#fcd34d",
              color: "var(--forge-warning)",
            }}
          >
            This instance requires initial setup before sign-in.
          </div>
          <p style={{ marginTop: "1rem", fontSize: 14 }}>
            <Link href="/setup" style={{ fontWeight: 600 }}>
              Continue to setup wizard
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="forge-auth-page">
      <div className="forge-auth-card">
        <div className="forge-auth-card__header">
          <ForgeOpsLogo />
          <h1 className="forge-auth-card__title">Sign in to ForgeOps</h1>
          <p className="forge-auth-card__subtitle">
            Merchandising, search operations, and governance for home-improvement catalogs.
          </p>
        </div>

        {error ? (
          <div
            className="forge-callout"
            style={{
              marginBottom: "1rem",
              background: "var(--forge-error-bg)",
              borderColor: "#fecaca",
              color: "var(--forge-error)",
            }}
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={signIn} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--forge-text-muted)" }}>
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
              className="forge-input"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--forge-text-muted)" }}>
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              className="forge-input"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="forge-btn forge-btn--primary"
            style={{ marginTop: 4, width: "100%" }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
