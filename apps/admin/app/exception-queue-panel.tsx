"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useCallback, useEffect, useState } from "react";
import type {
  ApprovalExceptionDto,
  ApprovalExceptionListResponseDto,
  ExceptionType,
} from "@retailer-search/shared-types";
import { ADMIN_APPROVALS_CHANGED_EVENT } from "./approval-panel";
import { ADMIN_DELEGATION_CHANGED_EVENT } from "./delegation-panel";

export const ADMIN_EXCEPTIONS_CHANGED_EVENT = "admin:exceptions-changed";

const TYPE_LABELS: Record<ExceptionType, string> = {
  reviewer_unavailable: "Reviewer unavailable",
  request_overdue: "Request overdue",
  role_mismatch: "Role mismatch",
  manual_intervention: "Manual intervention",
};

export function ExceptionQueuePanel() {
  const [exceptions, setExceptions] = useState<ApprovalExceptionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadExceptions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/approval-exceptions`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`Failed to load exceptions: HTTP ${response.status}`);
      }

      const body = (await response.json()) as ApprovalExceptionListResponseDto;
      setExceptions(body.exceptions);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load exception queue",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExceptions();

    const handler = () => {
      void loadExceptions();
    };

    window.addEventListener(ADMIN_EXCEPTIONS_CHANGED_EVENT, handler);
    window.addEventListener(ADMIN_APPROVALS_CHANGED_EVENT, handler);
    window.addEventListener(ADMIN_DELEGATION_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(ADMIN_EXCEPTIONS_CHANGED_EVENT, handler);
      window.removeEventListener(ADMIN_APPROVALS_CHANGED_EVENT, handler);
      window.removeEventListener(ADMIN_DELEGATION_CHANGED_EVENT, handler);
    };
  }, [loadExceptions]);

  const resolveException = async (id: string) => {
    setActingOnId(id);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/approval-exceptions/${id}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: "Handled in admin exception queue." }),
        },
      );

      if (!response.ok) {
        throw new Error(`Resolve failed with HTTP ${response.status}`);
      }

      setFeedback("Exception resolved.");
      await loadExceptions();
      window.dispatchEvent(new CustomEvent(ADMIN_EXCEPTIONS_CHANGED_EVENT));
    } catch (resolveError) {
      setError(
        resolveError instanceof Error ? resolveError.message : "Failed to resolve exception",
      );
    } finally {
      setActingOnId(null);
    }
  };

  const openCount = exceptions.filter((entry) => entry.status === "open").length;

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
        Approval exception queue
      </h2>

      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Open workflow problems that need operator attention. {openCount} open exception
        {openCount === 1 ? "" : "s"}.
      </p>

      {error && (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 13 }}>{error}</p>
      )}
      {feedback && (
        <p style={{ margin: "0 0 0.75rem", color: "#15803d", fontSize: 13 }}>{feedback}</p>
      )}

      {loading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Loading exceptions...</p>
      )}

      {!loading && exceptions.length === 0 && (
        <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>No exceptions in queue.</p>
      )}

      {!loading && exceptions.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.55rem" }}>
          {exceptions.map((exception) => (
            <li
              key={exception.id}
              style={{
                padding: "0.7rem",
                border: `1px solid ${exception.status === "open" ? "#fecaca" : "#e2e8f0"}`,
                borderRadius: 8,
                background: exception.status === "open" ? "#fff1f2" : "#fff",
                fontSize: 12,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: 4 }}>
                <strong>{TYPE_LABELS[exception.type]}</strong>
                <span style={{ color: exception.status === "open" ? "#b91c1c" : "#64748b" }}>
                  {exception.status}
                </span>
              </div>
              <p style={{ margin: "0 0 0.35rem", color: "#475569" }}>{exception.summary}</p>
              <p style={{ margin: "0 0 0.35rem", color: "#64748b" }}>
                Approval {exception.approvalRequestId} ·{" "}
                {new Date(exception.createdAt).toLocaleString()}
              </p>
              {exception.status === "open" && (
                <button
                  type="button"
                  disabled={actingOnId === exception.id}
                  onClick={() => void resolveException(exception.id)}
                  style={{
                    padding: "0.35rem 0.65rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {actingOnId === exception.id ? "Resolving..." : "Resolve"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
