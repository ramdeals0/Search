"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CurrentUserResponseDto } from "@retailer-search/shared-types";
import { clearAuthSession } from "../auth-session";
import { getAuthHeaders } from "../lib/auth-headers";
import { getSearchApiUrl } from "../lib/search-api-url";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function SessionTimeoutMonitor() {
  const router = useRouter();
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const lastActivityPingMs = useRef(0);

  const logout = useCallback(async () => {
    setWarningMessage(null);
    try {
      await fetch(`${getSearchApiUrl()}/api/v1/auth/logout`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
    } catch {
      // Best-effort logout before clearing local session state.
    } finally {
      clearAuthSession();
      router.push("/login?reason=session_expired");
      router.refresh();
    }
  }, [router]);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/auth/me`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      });

      if (!response.ok) {
        await logout();
        return;
      }

      const body = (await response.json()) as CurrentUserResponseDto;
      if (!body.authenticated || !body.session) {
        await logout();
        return;
      }

      const now = Date.now();
      const inactivityExpiresMs = new Date(body.session.inactivityExpiresAt).getTime();
      const absoluteExpiresMs = new Date(body.session.absoluteExpiresAt).getTime();
      const expiresMs = Math.min(inactivityExpiresMs, absoluteExpiresMs);
      const warningMs = body.session.warningBeforeExpiryMinutes * 60 * 1000;

      if (expiresMs <= now) {
        await logout();
        return;
      }

      if (expiresMs - now <= warningMs) {
        const reason =
          inactivityExpiresMs <= absoluteExpiresMs ? "inactivity" : "absolute lifetime";
        setWarningMessage(
          `Your session will expire in ${formatRemaining(expiresMs - now)} due to ${reason}. Move your mouse or press a key to stay signed in.`,
        );
      } else {
        setWarningMessage(null);
      }
    } catch {
      // Ignore transient network errors; the next poll will retry.
    }
  }, [logout]);

  useEffect(() => {
    void refreshSession();
    const poll = window.setInterval(() => {
      void refreshSession();
    }, 30_000);

    const pingActivity = () => {
      const now = Date.now();
      if (now - lastActivityPingMs.current < 60_000) {
        return;
      }
      lastActivityPingMs.current = now;
      void refreshSession();
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];

    for (const eventName of events) {
      window.addEventListener(eventName, pingActivity, { passive: true });
    }

    return () => {
      window.clearInterval(poll);
      for (const eventName of events) {
        window.removeEventListener(eventName, pingActivity);
      }
    };
  }, [refreshSession]);

  if (!warningMessage) {
    return null;
  }

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        insetInline: "1rem",
        top: "1rem",
        zIndex: 1000,
        padding: "0.85rem 1rem",
        borderRadius: 10,
        border: "1px solid #fcd34d",
        background: "#fffbeb",
        color: "#92400e",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
        display: "flex",
        gap: "0.75rem",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span style={{ fontSize: 14 }}>{warningMessage}</span>
      <button
        type="button"
        onClick={() => void refreshSession()}
        className="forge-btn forge-btn--secondary"
        style={{ whiteSpace: "nowrap" }}
      >
        Stay signed in
      </button>
    </div>
  );
}
