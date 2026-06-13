"use client";
import { buildSearchApiUrl, getSearchApiUrl } from "./lib/search-api-url";

import { useEffect, useState } from "react";
import type {
  ActionPreviewDto,
  ApplySuggestionResponseDto,
  RuleSuggestionDto,
  SuggestionActionType,
} from "@retailer-search/shared-types";

interface ActionPreviewProps {
  suggestion: RuleSuggestionDto;
  actionType: SuggestionActionType;
  onClose: () => void;
  onSuccess: (result: ApplySuggestionResponseDto) => void;
}

export function ActionPreview({
  suggestion,
  actionType,
  onClose,
  onSuccess,
}: ActionPreviewProps) {
  const [preview, setPreview] = useState<ActionPreviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      try {
        const url = buildSearchApiUrl(
          `/api/v1/admin/suggestions/${encodeURIComponent(suggestion.id)}/action-preview`,
        );
        url.searchParams.set("actionType", actionType);

        const response = await fetch(url.toString(), { cache: "no-store" });
        if (!response.ok) {
          let message = `Preview failed with HTTP ${response.status}`;
          try {
            const body = (await response.json()) as { error?: string };
            if (body.error) {
              message = body.error;
            }
          } catch {
            // Keep the status-based fallback message.
          }
          throw new Error(message);
        }

        if (!cancelled) {
          setPreview((await response.json()) as ActionPreviewDto);
        }
      } catch (previewError) {
        if (!cancelled) {
          setPreview(null);
          setError(
            previewError instanceof Error
              ? previewError.message
              : "Failed to load action preview",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [suggestion.id, actionType]);

  const confirmApply = async () => {
    setApplying(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/suggestions/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            suggestionId: suggestion.id,
            actionType,
          }),
        },
      );

      const result = (await response.json()) as ApplySuggestionResponseDto;
      if (!response.ok || !result.success) {
        throw new Error(result.message || `Apply failed with HTTP ${response.status}`);
      }

      setSuccessMessage(result.message);
      onSuccess(result);
    } catch (applyError) {
      setError(
        applyError instanceof Error ? applyError.message : "Apply failed",
      );
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      style={{
        marginTop: "0.75rem",
        padding: "0.85rem",
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        <strong style={{ fontSize: 14 }}>Confirm assisted action</strong>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "0.25rem 0.5rem",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            background: "#fff",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Close
        </button>
      </div>

      {loading && (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Loading preview...
        </p>
      )}

      {error && (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 14 }}>
          {error}
        </p>
      )}

      {successMessage && (
        <p style={{ margin: "0 0 0.75rem", color: "#15803d", fontSize: 14 }}>
          {successMessage}
        </p>
      )}

      {!loading && preview && (
        <>
          <p style={{ margin: "0 0 0.5rem", fontSize: 13, color: "#475569" }}>
            <strong>Action:</strong> {actionType.replaceAll("_", " ")}
          </p>
          <p style={{ margin: "0 0 0.75rem", fontSize: 14, color: "#334155" }}>
            {preview.summary}
          </p>
          <pre
            style={{
              margin: "0 0 0.75rem",
              padding: "0.75rem",
              borderRadius: 6,
              background: "#fff",
              border: "1px solid #e2e8f0",
              fontSize: 12,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {JSON.stringify(preview.payloadPreview, null, 2)}
          </pre>

          {!successMessage && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => void confirmApply()}
                disabled={applying}
                style={{
                  padding: "0.55rem 0.9rem",
                  border: "none",
                  borderRadius: 6,
                  background: "var(--forge-primary)",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {applying ? "Applying..." : "Confirm and apply"}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "0.55rem 0.9rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
