"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CreateReviewerRequestDto,
  ReviewerDto,
  ReviewerListResponseDto,
  ReviewerRole,
} from "@retailer-search/shared-types";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

export const ADMIN_REVIEWER_STORAGE_KEY = "admin-selected-reviewer-id";
export const ADMIN_REVIEWER_CHANGED_EVENT = "admin:reviewer-changed";

const ROLE_OPTIONS: ReviewerRole[] = [
  "requester",
  "reviewer",
  "approver",
  "release_manager",
];

const inputStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
} as const;

export function ReviewerManagementPanel() {
  const [reviewers, setReviewers] = useState<ReviewerDto[]>([]);
  const [selectedReviewerId, setSelectedReviewerId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<ReviewerRole>("reviewer");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadReviewers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${SEARCH_API_URL}/api/v1/admin/reviewers`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to load reviewers: HTTP ${response.status}`);
      }

      const data = (await response.json()) as ReviewerListResponseDto;
      setReviewers(data.reviewers);

      const storedId = window.localStorage.getItem(ADMIN_REVIEWER_STORAGE_KEY);
      const initialId =
        storedId && data.reviewers.some((reviewer) => reviewer.id === storedId)
          ? storedId
          : (data.reviewers.find((reviewer) => reviewer.active)?.id ?? "");
      setSelectedReviewerId(initialId);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load reviewers",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReviewers();
  }, [loadReviewers]);

  const selectReviewer = (reviewerId: string) => {
    setSelectedReviewerId(reviewerId);
    window.localStorage.setItem(ADMIN_REVIEWER_STORAGE_KEY, reviewerId);
    window.dispatchEvent(
      new CustomEvent(ADMIN_REVIEWER_CHANGED_EVENT, {
        detail: { reviewerId },
      }),
    );
  };

  const createReviewer = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    setCreating(true);
    setError(null);
    setFeedback(null);

    try {
      const payload: CreateReviewerRequestDto = {
        name: trimmedName,
        role,
      };

      const response = await fetch(`${SEARCH_API_URL}/api/v1/admin/reviewers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Create reviewer failed with HTTP ${response.status}`);
      }

      setName("");
      setFeedback("Reviewer created.");
      await loadReviewers();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create reviewer",
      );
    } finally {
      setCreating(false);
    }
  };

  const toggleReviewerActive = async (reviewer: ReviewerDto) => {
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/reviewers/${reviewer.id}/active`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !reviewer.active }),
        },
      );

      if (!response.ok) {
        throw new Error(`Update reviewer failed with HTTP ${response.status}`);
      }

      setFeedback(`Reviewer '${reviewer.name}' updated.`);
      await loadReviewers();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update reviewer",
      );
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
        Reviewer identities
      </h2>

      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        MVP stand-in for real identities. Select the active reviewer context used
        for approval and execution actions below.
      </p>

      <label
        style={{
          display: "grid",
          gap: 4,
          fontSize: 13,
          marginBottom: "1rem",
        }}
      >
        Active reviewer context
        <select
          value={selectedReviewerId}
          onChange={(event) => selectReviewer(event.target.value)}
          style={inputStyle}
        >
          <option value="">Select reviewer</option>
          {reviewers
            .filter((reviewer) => reviewer.active)
            .map((reviewer) => (
              <option key={reviewer.id} value={reviewer.id}>
                {reviewer.name} ({reviewer.role})
              </option>
            ))}
        </select>
      </label>

      <form
        onSubmit={(event) => void createReviewer(event)}
        style={{
          display: "grid",
          gap: "0.75rem",
          marginBottom: "1rem",
          padding: "0.85rem",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#f8fafc",
        }}
      >
        <strong style={{ fontSize: 14 }}>Create reviewer</strong>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} style={inputStyle} />
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Role
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as ReviewerRole)}
            style={inputStyle}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={creating}
          style={{
            justifySelf: "start",
            padding: "0.55rem 0.9rem",
            border: "none",
            borderRadius: 6,
            background: "var(--forge-primary)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          {creating ? "Creating..." : "Create reviewer"}
        </button>
      </form>

      {feedback && (
        <p style={{ margin: "0 0 0.75rem", color: "#15803d", fontSize: 13 }}>
          {feedback}
        </p>
      )}
      {error && (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 13 }}>
          {error}
        </p>
      )}

      {loading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Loading reviewers...
        </p>
      )}

      {!loading && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: "0.5rem",
          }}
        >
          {reviewers.map((reviewer) => (
            <li
              key={reviewer.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "0.75rem",
                alignItems: "center",
                padding: "0.65rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              <span>
                <strong>{reviewer.name}</strong> · {reviewer.role} ·{" "}
                {reviewer.active ? "active" : "inactive"}
              </span>
              <button
                type="button"
                onClick={() => void toggleReviewerActive(reviewer)}
                style={{
                  padding: "0.35rem 0.6rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                {reviewer.active ? "Deactivate" : "Activate"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
