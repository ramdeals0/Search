"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ActiveConfigurationDto,
  ApprovalListResponseDto,
  ApprovalSlaOverviewDto,
  ExperimentDto,
  PromotionHistoryResponseDto,
  SearchAnalyticsSummaryDto,
  SuggestionsResponseDto,
  WorkspaceRole,
} from "@retailer-search/shared-types";
import { WORKSPACE_ROLE_CHANGED_EVENT } from "./workspace-switcher";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

interface SummaryCard {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "warning" | "danger" | "success";
}

const TONE_COLORS: Record<NonNullable<SummaryCard["tone"]>, string> = {
  neutral: "#334155",
  warning: "#b45309",
  danger: "#b91c1c",
  success: "#15803d",
};

interface WorkspaceSummaryCardsProps {
  activeRole: WorkspaceRole;
  analytics: SearchAnalyticsSummaryDto;
}

export function WorkspaceSummaryCards({
  activeRole,
  analytics,
}: WorkspaceSummaryCardsProps) {
  const [cards, setCards] = useState<SummaryCard[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCards = useCallback(async () => {
    setLoading(true);

    try {
      const nextCards = await buildCardsForRole(activeRole, analytics);
      setCards(nextCards);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [activeRole, analytics]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  useEffect(() => {
    const handler = () => {
      void loadCards();
    };

    window.addEventListener(WORKSPACE_ROLE_CHANGED_EVENT, handler);
    window.addEventListener("admin:approvals-changed", handler);
    window.addEventListener("admin:exceptions-changed", handler);
    return () => {
      window.removeEventListener(WORKSPACE_ROLE_CHANGED_EVENT, handler);
      window.removeEventListener("admin:approvals-changed", handler);
      window.removeEventListener("admin:exceptions-changed", handler);
    };
  }, [loadCards]);

  return (
    <section
      style={{
        padding: "0.85rem",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#f8fafc",
      }}
    >
      <h2 style={{ margin: "0 0 0.65rem", fontSize: "1rem" }}>
        {activeRole.replace("_", " ")} summary
      </h2>

      {loading && (
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Loading summary...</p>
      )}

      {!loading && cards.length === 0 && (
        <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>No summary metrics.</p>
      )}

      {!loading && cards.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "0.65rem",
          }}
        >
          {cards.map((card) => (
            <div
              key={card.label}
              style={{
                padding: "0.65rem",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                background: "#fff",
              }}
            >
              <div style={{ fontSize: 11, color: "#64748b" }}>{card.label}</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: TONE_COLORS[card.tone ?? "neutral"],
                }}
              >
                {card.value}
              </div>
              {card.hint && (
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {card.hint}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const response = await fetch(`${SEARCH_API_URL}${path}`, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}

async function buildCardsForRole(
  role: WorkspaceRole,
  analytics: SearchAnalyticsSummaryDto,
): Promise<SummaryCard[]> {
  if (role === "merchandiser") {
    const [suggestions, experiments] = await Promise.all([
      fetchJson<SuggestionsResponseDto>("/api/v1/admin/suggestions"),
      fetchJson<{ total: number; experiments: ExperimentDto[] }>(
        "/api/v1/admin/experiments",
      ),
    ]);

    return [
      {
        label: "No-result queries",
        value: String(analytics.noResultQueries.length),
        hint: analytics.noResultQueries[0]?.query ?? "none yet",
        tone: analytics.noResultQueries.length > 0 ? "warning" : "neutral",
      },
      {
        label: "Active suggestions",
        value: String(suggestions?.suggestions.length ?? 0),
        tone: "neutral",
      },
      {
        label: "Experiments",
        value: String(experiments?.experiments.length ?? 0),
        tone: "neutral",
      },
    ];
  }

  if (role === "reviewer" || role === "approver") {
    const [approvals, exceptions, sla, notifications] = await Promise.all([
      fetchJson<ApprovalListResponseDto>("/api/v1/admin/approvals"),
      fetchJson<{ total: number; exceptions: { status: string }[] }>(
        "/api/v1/admin/approval-exceptions",
      ),
      fetchJson<ApprovalSlaOverviewDto>("/api/v1/admin/approval-sla"),
      fetchJson<{ total: number; notifications: { read: boolean }[] }>(
        "/api/v1/admin/notifications",
      ),
    ]);

    const pendingApprovals =
      approvals?.requests.filter((request) => request.status === "pending").length ??
      0;
    const openExceptions =
      exceptions?.exceptions.filter((entry) => entry.status === "open").length ?? 0;
    const unreadNotifications =
      notifications?.notifications.filter((entry) => !entry.read).length ?? 0;

    if (role === "reviewer") {
      return [
        {
          label: "Pending approvals",
          value: String(pendingApprovals),
          tone: pendingApprovals > 0 ? "warning" : "neutral",
        },
        {
          label: "Open exceptions",
          value: String(openExceptions),
          tone: openExceptions > 0 ? "danger" : "neutral",
        },
        {
          label: "Unread notifications",
          value: String(unreadNotifications),
          tone: unreadNotifications > 0 ? "warning" : "neutral",
        },
      ];
    }

    return [
      {
        label: "Due soon",
        value: String(sla?.summary.dueSoonCount ?? 0),
        tone: "warning",
      },
      {
        label: "Overdue",
        value: String(sla?.summary.overdueCount ?? 0),
        tone: (sla?.summary.overdueCount ?? 0) > 0 ? "danger" : "neutral",
      },
      {
        label: "Awaiting action",
        value: String(pendingApprovals),
        tone: pendingApprovals > 0 ? "warning" : "neutral",
      },
    ];
  }

  if (role === "release_manager") {
    const [activeConfig, promotions, approvals] = await Promise.all([
      fetchJson<ActiveConfigurationDto>("/api/v1/admin/active-configuration"),
      fetchJson<PromotionHistoryResponseDto>("/api/v1/admin/promotions"),
      fetchJson<ApprovalListResponseDto>("/api/v1/admin/approvals"),
    ]);

    const readyToExecute =
      approvals?.requests.filter((request) => request.status === "approved").length ??
      0;

    return [
      {
        label: "Live snapshot",
        value: activeConfig?.snapshotName ?? "none",
        hint: activeConfig?.promotedAt
          ? new Date(activeConfig.promotedAt).toLocaleString()
          : undefined,
        tone: activeConfig ? "success" : "neutral",
      },
      {
        label: "Ready to execute",
        value: String(readyToExecute),
        tone: readyToExecute > 0 ? "warning" : "neutral",
      },
      {
        label: "Recent promotions",
        value: String(promotions?.entries.length ?? 0),
        tone: "neutral",
      },
    ];
  }

  const [approvals, experiments, exceptions, promotions] = await Promise.all([
    fetchJson<ApprovalListResponseDto>("/api/v1/admin/approvals"),
    fetchJson<{ total: number; experiments: ExperimentDto[] }>(
      "/api/v1/admin/experiments",
    ),
    fetchJson<{ total: number; exceptions: { status: string }[] }>(
      "/api/v1/admin/approval-exceptions",
    ),
    fetchJson<PromotionHistoryResponseDto>("/api/v1/admin/promotions"),
  ]);

  return [
    { label: "Total searches", value: String(analytics.totalSearches) },
    {
      label: "Pending approvals",
      value: String(
        approvals?.requests.filter((request) => request.status === "pending")
          .length ?? 0,
      ),
    },
    { label: "Experiments", value: String(experiments?.experiments.length ?? 0) },
    {
      label: "Open exceptions",
      value: String(
        exceptions?.exceptions.filter((entry) => entry.status === "open").length ?? 0,
      ),
    },
    { label: "Promotions", value: String(promotions?.entries.length ?? 0) },
  ];
}
