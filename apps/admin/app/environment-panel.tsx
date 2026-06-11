"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ApprovalListResponseDto,
  EnvironmentConfigurationDto,
  EnvironmentListResponseDto,
} from "@retailer-search/shared-types";
import { ADMIN_APPROVALS_CHANGED_EVENT } from "./approval-panel";
import { ADMIN_ENVIRONMENT_CHANGED_EVENT } from "./environment-switcher";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

const textareaStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
  minHeight: 64,
  resize: "vertical" as const,
  fontFamily: "inherit",
};

function renderEnvironmentSummary(config: EnvironmentConfigurationDto) {
  return (
    <div style={{ fontSize: 13, color: "#475569" }}>
      <div>
        <strong style={{ textTransform: "capitalize" }}>{config.environment}</strong>
        {config.snapshotName ? ` · linked snapshot ${config.snapshotName}` : ""}
      </div>
      <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
        Updated {new Date(config.updatedAt).toLocaleString()} ·{" "}
        {config.counts.rules} rules · {config.counts.synonyms} synonyms
      </div>
    </div>
  );
}

export function EnvironmentPanel() {
  const [environments, setEnvironments] = useState<EnvironmentConfigurationDto[]>(
    [],
  );
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [copyReason, setCopyReason] = useState(
    "Reset staging to match current live baseline.",
  );
  const [promoteReason, setPromoteReason] = useState(
    "Approved staging changes ready for live search.",
  );
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadEnvironments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [envRes, approvalsRes] = await Promise.all([
        fetch(`${SEARCH_API_URL}/api/v1/admin/environments`, {
          cache: "no-store",
        }),
        fetch(`${SEARCH_API_URL}/api/v1/admin/approvals`, {
          cache: "no-store",
        }),
      ]);

      if (!envRes.ok) {
        throw new Error(`Failed to load environments: HTTP ${envRes.status}`);
      }

      const data = (await envRes.json()) as EnvironmentListResponseDto;
      setEnvironments(data.environments);

      if (approvalsRes.ok) {
        const approvals = (await approvalsRes.json()) as ApprovalListResponseDto;
        setPendingApprovals(
          approvals.requests.filter((request) => request.status === "pending")
            .length,
        );
      } else {
        setPendingApprovals(0);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load environments",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEnvironments();

    const handler = () => {
      void loadEnvironments();
    };

    window.addEventListener(ADMIN_ENVIRONMENT_CHANGED_EVENT, handler);
    window.addEventListener("admin:active-config-changed", handler);
    window.addEventListener(ADMIN_APPROVALS_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(ADMIN_ENVIRONMENT_CHANGED_EVENT, handler);
      window.removeEventListener("admin:active-config-changed", handler);
      window.removeEventListener(ADMIN_APPROVALS_CHANGED_EVENT, handler);
    };
  }, [loadEnvironments]);

  const staging = environments.find((item) => item.environment === "staging");
  const live = environments.find((item) => item.environment === "live");

  const copyLiveToStaging = async () => {
    const trimmedReason = copyReason.trim();
    if (!trimmedReason) {
      setError("Copy reason is required.");
      return;
    }

    if (
      !window.confirm(
        "Copy live configuration into staging? This replaces staging rules and synonyms.",
      )
    ) {
      return;
    }

    setCopying(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/environments/copy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromEnvironment: "live",
            toEnvironment: "staging",
            reason: trimmedReason,
          }),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? `Copy failed with HTTP ${response.status}`);
      }

      setFeedback(body?.message ?? "Copied live configuration to staging.");
      await loadEnvironments();
      window.dispatchEvent(new CustomEvent("admin:active-config-changed"));
    } catch (copyError) {
      setError(
        copyError instanceof Error ? copyError.message : "Failed to copy environments",
      );
    } finally {
      setCopying(false);
    }
  };

  const promoteStagingToLive = async () => {
    const trimmedReason = promoteReason.trim();
    if (!trimmedReason) {
      setError("Promotion reason is required.");
      return;
    }

    if (
      !window.confirm(
        "Promote staging to live? This replaces live rules and synonyms immediately.",
      )
    ) {
      return;
    }

    setPromoting(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/environments/promote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromEnvironment: "staging",
            toEnvironment: "live",
            reason: trimmedReason,
          }),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          body?.error ?? `Promotion failed with HTTP ${response.status}`,
        );
      }

      setFeedback(body?.message ?? "Promoted staging configuration to live.");
      await loadEnvironments();
      window.dispatchEvent(new CustomEvent("admin:active-config-changed"));
    } catch (promoteError) {
      setError(
        promoteError instanceof Error
          ? promoteError.message
          : "Failed to promote staging to live",
      );
    } finally {
      setPromoting(false);
    }
  };

  return (
    <section
      style={{
        padding: "1rem",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>
        Staging vs live environments
      </h2>

      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Staging is the safe editing space. Live is the storefront-facing
        configuration used by public search. Prefer approval-gated promotion over
        direct staging → live when releasing snapshots.
      </p>

      {!loading && pendingApprovals > 0 && (
        <p
          style={{
            margin: "0 0 1rem",
            padding: "0.65rem 0.75rem",
            borderRadius: 6,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            fontSize: 13,
            color: "#92400e",
          }}
        >
          {pendingApprovals} pending release approval
          {pendingApprovals === 1 ? "" : "s"} waiting for review.
        </p>
      )}

      {loading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Loading environment state...
        </p>
      )}

      {!loading && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                padding: "0.75rem",
                border: "1px solid #bfdbfe",
                borderRadius: 8,
                background: "#eff6ff",
              }}
            >
              <strong style={{ fontSize: 13 }}>Staging</strong>
              {staging ? (
                <>
                  {renderEnvironmentSummary(staging)}
                  {staging.snapshotName && (
                    <p style={{ margin: "0.35rem 0 0", fontSize: 12, color: "#64748b" }}>
                      Candidate snapshot linked in staging metadata.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ margin: "0.35rem 0 0", color: "#64748b" }}>
                  Not loaded
                </p>
              )}
            </div>

            <div
              style={{
                padding: "0.75rem",
                border: "1px solid #86efac",
                borderRadius: 8,
                background: "#f0fdf4",
              }}
            >
              <strong style={{ fontSize: 13 }}>Live</strong>
              {live ? (
                renderEnvironmentSummary(live)
              ) : (
                <p style={{ margin: "0.35rem 0 0", color: "#64748b" }}>
                  Not loaded
                </p>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              padding: "0.85rem",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              background: "#f8fafc",
            }}
          >
            <strong style={{ fontSize: 14 }}>Copy live → staging</strong>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Reason
              <textarea
                value={copyReason}
                onChange={(event) => setCopyReason(event.target.value)}
                style={textareaStyle}
              />
            </label>
            <button
              type="button"
              onClick={() => void copyLiveToStaging()}
              disabled={copying}
              style={{
                justifySelf: "start",
                padding: "0.5rem 0.8rem",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                background: "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {copying ? "Copying..." : "Copy live to staging"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              padding: "0.85rem",
              border: "1px solid #fde68a",
              borderRadius: 8,
              background: "#fffbeb",
            }}
          >
            <strong style={{ fontSize: 14 }}>Promote staging → live (direct)</strong>
            <p style={{ margin: 0, fontSize: 12, color: "#92400e" }}>
              Bypasses approval gates. Use snapshot approval workflow when possible.
            </p>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Reason
              <textarea
                value={promoteReason}
                onChange={(event) => setPromoteReason(event.target.value)}
                style={textareaStyle}
              />
            </label>
            <button
              type="button"
              onClick={() => void promoteStagingToLive()}
              disabled={promoting}
              style={{
                justifySelf: "start",
                padding: "0.5rem 0.8rem",
                border: "none",
                borderRadius: 6,
                background: "#15803d",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {promoting ? "Promoting..." : "Promote staging to live"}
            </button>
          </div>

          {feedback && (
            <p style={{ margin: 0, color: "#15803d", fontSize: 13 }}>
              {feedback}
            </p>
          )}
          {error && (
            <p style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
