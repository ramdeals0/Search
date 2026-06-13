"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useCallback, useEffect, useState } from "react";
import type {
  CollaborationAnnotationDto,
  CollaborationTargetType,
  CollaborationThreadDto,
} from "@retailer-search/shared-types";
import { ADMIN_COLLABORATION_CHANGED_EVENT } from "./comments-panel";

const inputStyle = {
  padding: "0.45rem 0.6rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 12,
  width: "100%",
  fontFamily: "inherit",
} as const;

interface AnnotationPanelProps {
  targetType: CollaborationTargetType;
  targetId: string;
  actorId: string;
  actorLabel: string;
  title?: string;
  defaultAnchorLabel?: string;
}

export function AnnotationPanel({
  targetType,
  targetId,
  actorId,
  actorLabel,
  title = "Annotations",
  defaultAnchorLabel = "",
}: AnnotationPanelProps) {
  const [annotations, setAnnotations] = useState<CollaborationAnnotationDto[]>([]);
  const [anchorLabel, setAnchorLabel] = useState(defaultAnchorLabel);
  const [note, setNote] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadThread = useCallback(async () => {
    if (!targetId) {
      setAnnotations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        targetType,
        targetId,
      });
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/collaboration/thread?${params.toString()}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`Failed to load annotations: HTTP ${response.status}`);
      }

      const body = (await response.json()) as CollaborationThreadDto;
      setAnnotations(body.annotations);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load annotations",
      );
    } finally {
      setLoading(false);
    }
  }, [targetId, targetType]);

  useEffect(() => {
    setAnchorLabel(defaultAnchorLabel);
  }, [defaultAnchorLabel, targetId]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    const handler = () => {
      void loadThread();
    };

    window.addEventListener(ADMIN_COLLABORATION_CHANGED_EVENT, handler);
    return () =>
      window.removeEventListener(ADMIN_COLLABORATION_CHANGED_EVENT, handler);
  }, [loadThread]);

  const parseTags = (value: string): string[] | undefined => {
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    return tags.length > 0 ? tags : undefined;
  };

  const addAnnotation = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!actorId || !actorLabel) {
      setError("Select a reviewer context before annotating.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/collaboration/annotations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType,
            targetId,
            actorId,
            actorLabel,
            anchorLabel,
            note,
            tags: parseTags(tagsInput),
          }),
        },
      );

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(
          body?.error ?? `Add annotation failed with HTTP ${response.status}`,
        );
      }

      setNote("");
      setTagsInput("");
      if (!defaultAnchorLabel) {
        setAnchorLabel("");
      }
      await loadThread();
      window.dispatchEvent(new CustomEvent(ADMIN_COLLABORATION_CHANGED_EVENT));
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to add annotation",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        marginTop: "0.65rem",
        padding: "0.75rem",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <strong style={{ fontSize: 13 }}>{title}</strong>

      {error && (
        <p style={{ margin: "0.5rem 0 0", color: "#b91c1c", fontSize: 12 }}>{error}</p>
      )}

      {loading && (
        <p style={{ margin: "0.5rem 0 0", color: "#64748b", fontSize: 12 }}>
          Loading annotations...
        </p>
      )}

      {!loading && annotations.length === 0 && (
        <p style={{ margin: "0.5rem 0 0", color: "#94a3b8", fontSize: 12 }}>
          No annotations yet.
        </p>
      )}

      {!loading && annotations.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: "0.5rem 0 0",
            padding: 0,
            display: "grid",
            gap: "0.45rem",
          }}
        >
          {annotations.map((annotation) => (
            <li
              key={annotation.id}
              style={{
                padding: "0.6rem",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginBottom: "0.25rem",
                }}
              >
                <strong>{annotation.anchorLabel}</strong>
                <span style={{ color: "#64748b" }}>
                  {annotation.author.actorLabel}
                </span>
                <span style={{ color: "#94a3b8" }}>
                  {new Date(annotation.createdAt).toLocaleString()}
                </span>
              </div>
              <p style={{ margin: "0 0 0.25rem", color: "#334155" }}>
                {annotation.note}
              </p>
              {annotation.tags && annotation.tags.length > 0 && (
                <p style={{ margin: 0, color: "#64748b", fontSize: 11 }}>
                  Tags: {annotation.tags.join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(event) => void addAnnotation(event)}
        style={{ display: "grid", gap: "0.45rem", marginTop: "0.65rem" }}
      >
        <input
          value={anchorLabel}
          onChange={(event) => setAnchorLabel(event.target.value)}
          placeholder="Anchor label (e.g. query: drill, release rationale)"
          style={inputStyle}
        />
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Annotation note..."
          style={{ ...inputStyle, minHeight: 56, resize: "vertical" }}
        />
        <input
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          placeholder="Tags (optional, comma-separated)"
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={saving || !targetId}
          style={{
            justifySelf: "start",
            padding: "0.4rem 0.7rem",
            border: "none",
            borderRadius: 6,
            background: "#334155",
            color: "#fff",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {saving ? "Saving..." : "Add annotation"}
        </button>
      </form>
    </div>
  );
}
