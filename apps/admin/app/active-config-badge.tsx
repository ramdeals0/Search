"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useCallback, useEffect, useState } from "react";
import type { ActiveConfigurationDto } from "@retailer-search/shared-types";

export function ActiveConfigBadge() {
  const [activeConfiguration, setActiveConfiguration] =
    useState<ActiveConfigurationDto | null>(null);
  const [loading, setLoading] = useState(true);

  const loadActiveConfiguration = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/active-configuration`,
        { cache: "no-store" },
      );

      if (response.status === 404) {
        setActiveConfiguration(null);
        return;
      }

      if (!response.ok) {
        throw new Error(
          `Failed to load active configuration: HTTP ${response.status}`,
        );
      }

      setActiveConfiguration(
        (await response.json()) as ActiveConfigurationDto,
      );
    } catch {
      setActiveConfiguration(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActiveConfiguration();

    const handler = () => {
      void loadActiveConfiguration();
    };

    window.addEventListener("admin:active-config-changed", handler);
    window.addEventListener("admin:approvals-changed", handler);
    return () => {
      window.removeEventListener("admin:active-config-changed", handler);
      window.removeEventListener("admin:approvals-changed", handler);
    };
  }, [loadActiveConfiguration]);

  if (loading) {
    return (
      <div
        style={{
          padding: "0.65rem 0.85rem",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#f8fafc",
          fontSize: 13,
          color: "#64748b",
        }}
      >
        Loading active configuration...
      </div>
    );
  }

  if (!activeConfiguration) {
    return (
      <div
        style={{
          padding: "0.65rem 0.85rem",
          border: "1px dashed #cbd5e1",
          borderRadius: 8,
          background: "#f8fafc",
          fontSize: 13,
          color: "#64748b",
        }}
      >
        <strong style={{ color: "#475569" }}>Active configuration:</strong> none
        promoted yet — live rules reflect manual edits or rollback state.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "0.65rem 0.85rem",
        border: "1px solid #86efac",
        borderRadius: 8,
        background: "#f0fdf4",
        fontSize: 13,
        color: "#166534",
        display: "flex",
        flexWrap: "wrap",
        gap: "0.75rem",
        alignItems: "center",
      }}
    >
      <strong>Live:</strong>
      <span>{activeConfiguration.snapshotName}</span>
      <span style={{ color: "#15803d" }}>
        promoted {new Date(activeConfiguration.promotedAt).toLocaleString()}
      </span>
      <span>
        {activeConfiguration.counts.rules} rules ·{" "}
        {activeConfiguration.counts.synonyms} synonyms
      </span>
      {activeConfiguration.promotedViaApprovalRequestId && (
        <span style={{ fontSize: 12, color: "#15803d" }}>
          via approval {activeConfiguration.promotedViaApprovalRequestId}
        </span>
      )}
    </div>
  );
}
