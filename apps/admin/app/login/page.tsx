"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BootstrapStateDto, LoginResponseDto } from "@retailer-search/shared-types";
import { AUTH_TOKEN_STORAGE_KEY } from "../access-request-panel";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

export default function LoginPage() {
  const router = useRouter();
  const [setupStatus, setSetupStatus] = useState<BootstrapStateDto | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, body.session.token);
      router.push("/");
      router.refresh();
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingSetup) {
    return (
      <main style={{ maxWidth: 420, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <p style={{ color: "#64748b", fontSize: 14 }}>Checking instance status…</p>
      </main>
    );
  }

  if (setupStatus?.setupRequired) {
    return (
      <main style={{ maxWidth: 420, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <h1 style={{ marginTop: 0, fontSize: 24 }}>Admin sign in</h1>
        <div
          style={{
            border: "1px solid #fcd34d",
            background: "#fffbeb",
            borderRadius: 8,
            padding: "1rem",
            fontSize: 14,
            color: "#92400e",
          }}
        >
          This instance requires initial setup before sign-in.
        </div>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          <Link href="/setup" style={{ color: "#2563eb", fontWeight: 600 }}>
            Continue to setup wizard
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ marginTop: 0, fontSize: 24 }}>Admin sign in</h1>
      <p style={{ marginTop: 0, color: "#64748b", fontSize: 14 }}>
        Sign in with your admin credentials to access merchandising controls.
      </p>

      {error ? (
        <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>
      ) : null}

      <form onSubmit={signIn} style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          required
          style={inputStyle}
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          required
          style={inputStyle}
        />
        <button type="submit" disabled={submitting} style={buttonStyle}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
};

const buttonStyle: React.CSSProperties = {
  width: "fit-content",
  padding: "0.5rem 0.9rem",
  borderRadius: 6,
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#fff",
  cursor: "pointer",
  fontSize: 14,
};
