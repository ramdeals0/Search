"use client";

import { useEffect, useState } from "react";
import type { EnvironmentKey } from "@retailer-search/shared-types";

export const ADMIN_ENVIRONMENT_STORAGE_KEY = "admin-environment-context";
export const ADMIN_ENVIRONMENT_CHANGED_EVENT = "admin:environment-changed";

function readStoredEnvironment(): EnvironmentKey {
  if (typeof window === "undefined") {
    return "staging";
  }

  const stored = window.localStorage.getItem(ADMIN_ENVIRONMENT_STORAGE_KEY);
  return stored === "live" ? "live" : "staging";
}

export function getAdminEnvironmentContext(): EnvironmentKey {
  return readStoredEnvironment();
}

export function EnvironmentSwitcher() {
  const [environment, setEnvironment] = useState<EnvironmentKey>("staging");

  useEffect(() => {
    setEnvironment(readStoredEnvironment());
  }, []);

  const selectEnvironment = (nextEnvironment: EnvironmentKey) => {
    setEnvironment(nextEnvironment);
    window.localStorage.setItem(ADMIN_ENVIRONMENT_STORAGE_KEY, nextEnvironment);
    window.dispatchEvent(
      new CustomEvent(ADMIN_ENVIRONMENT_CHANGED_EVENT, {
        detail: { environment: nextEnvironment },
      }),
    );
  };

  const buttonStyle = (value: EnvironmentKey) => ({
    padding: "0.4rem 0.75rem",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    background: environment === value ? "#0f172a" : "#fff",
    color: environment === value ? "#fff" : "#334155",
    cursor: "pointer" as const,
    fontSize: 13,
    fontWeight: 600,
  });

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.75rem",
        alignItems: "center",
        padding: "0.65rem 0.85rem",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#fff",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#475569" }}>
        <strong>Admin editing context:</strong>
      </span>
      <div style={{ display: "flex", gap: "0.35rem" }}>
        <button
          type="button"
          onClick={() => selectEnvironment("staging")}
          style={buttonStyle("staging")}
        >
          Staging
        </button>
        <button
          type="button"
          onClick={() => selectEnvironment("live")}
          style={buttonStyle("live")}
        >
          Live
        </button>
      </div>
      <span style={{ color: "#64748b" }}>
        {environment === "staging"
          ? "Safe editing space — changes do not affect storefront search."
          : "Production-like config — edits apply to live search immediately."}
      </span>
    </div>
  );
}
