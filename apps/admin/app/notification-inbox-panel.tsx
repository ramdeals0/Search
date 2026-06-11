"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  NotificationDto,
  NotificationListResponseDto,
  NotificationType,
} from "@retailer-search/shared-types";
import { ADMIN_APPROVALS_CHANGED_EVENT } from "./approval-panel";
import { ADMIN_SLA_CHANGED_EVENT } from "./approval-sla-panel";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

export const ADMIN_NOTIFICATIONS_CHANGED_EVENT = "admin:notifications-changed";

const TYPE_LABELS: Record<NotificationType, string> = {
  approval_requested: "Requested",
  approval_reminder: "Reminder",
  approval_overdue: "Overdue",
  approval_approved: "Approved",
  approval_rejected: "Rejected",
  approval_executed: "Executed",
};

export function NotificationInboxPanel() {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/notifications`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`Failed to load notifications: HTTP ${response.status}`);
      }

      const body = (await response.json()) as NotificationListResponseDto;
      setNotifications(body.notifications);
      setTotal(body.total);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load notification inbox",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();

    const handler = () => {
      void loadNotifications();
    };

    window.addEventListener(ADMIN_NOTIFICATIONS_CHANGED_EVENT, handler);
    window.addEventListener(ADMIN_APPROVALS_CHANGED_EVENT, handler);
    window.addEventListener(ADMIN_SLA_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(ADMIN_NOTIFICATIONS_CHANGED_EVENT, handler);
      window.removeEventListener(ADMIN_APPROVALS_CHANGED_EVENT, handler);
      window.removeEventListener(ADMIN_SLA_CHANGED_EVENT, handler);
    };
  }, [loadNotifications]);

  const markRead = async (id: string) => {
    setActingOnId(id);
    setError(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/notifications/${id}/read`,
        { method: "POST" },
      );

      if (!response.ok) {
        throw new Error(`Mark read failed with HTTP ${response.status}`);
      }

      await loadNotifications();
      window.dispatchEvent(new CustomEvent(ADMIN_NOTIFICATIONS_CHANGED_EVENT));
    } catch (markError) {
      setError(
        markError instanceof Error ? markError.message : "Failed to mark as read",
      );
    } finally {
      setActingOnId(null);
    }
  };

  const markAllRead = async () => {
    setActingOnId("all");
    setError(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/notifications/read-all`,
        { method: "POST" },
      );

      if (!response.ok) {
        throw new Error(`Mark all read failed with HTTP ${response.status}`);
      }

      await loadNotifications();
      window.dispatchEvent(new CustomEvent(ADMIN_NOTIFICATIONS_CHANGED_EVENT));
    } catch (markError) {
      setError(
        markError instanceof Error
          ? markError.message
          : "Failed to mark all as read",
      );
    } finally {
      setActingOnId(null);
    }
  };

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <section
      style={{
        padding: "1rem",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Notification inbox</h2>
        <button
          type="button"
          disabled={actingOnId === "all" || unreadCount === 0}
          onClick={() => void markAllRead()}
          style={{
            padding: "0.4rem 0.75rem",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            background: "#fff",
            cursor: unreadCount === 0 ? "not-allowed" : "pointer",
            fontSize: 12,
          }}
        >
          {actingOnId === "all" ? "Marking..." : "Mark all read"}
        </button>
      </div>

      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        In-app simulated notifications only. {unreadCount} unread of {total} total.
      </p>

      {error && (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 13 }}>
          {error}
        </p>
      )}

      {loading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Loading notifications...
        </p>
      )}

      {!loading && notifications.length === 0 && (
        <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
          No notifications yet.
        </p>
      )}

      {!loading && notifications.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: "0.55rem",
          }}
        >
          {notifications.map((notification) => (
            <li
              key={notification.id}
              style={{
                padding: "0.7rem",
                border: `1px solid ${notification.read ? "#e2e8f0" : "#bfdbfe"}`,
                borderRadius: 8,
                background: notification.read ? "#fff" : "#eff6ff",
                fontSize: 13,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  alignItems: "center",
                  marginBottom: "0.25rem",
                }}
              >
                <strong>{notification.title}</strong>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: notification.read ? "#64748b" : "#1d4ed8",
                  }}
                >
                  {notification.read ? "read" : "unread"}
                </span>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {TYPE_LABELS[notification.type]}
                </span>
              </div>

              <p style={{ margin: "0 0 0.35rem", color: "#475569" }}>
                {notification.message}
              </p>

              <p style={{ margin: "0 0 0.35rem", color: "#64748b", fontSize: 12 }}>
                {new Date(notification.createdAt).toLocaleString()}
                {notification.relatedApprovalRequestId
                  ? ` · approval ${notification.relatedApprovalRequestId}`
                  : ""}
                {notification.recipientActorId
                  ? ` · recipient ${notification.recipientActorId}`
                  : ""}
              </p>

              {!notification.read && (
                <button
                  type="button"
                  disabled={actingOnId === notification.id}
                  onClick={() => void markRead(notification.id)}
                  style={{
                    padding: "0.35rem 0.65rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {actingOnId === notification.id ? "Saving..." : "Mark read"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
