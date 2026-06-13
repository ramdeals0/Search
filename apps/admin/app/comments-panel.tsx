"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CollaborationCommentDto,
  CollaborationTargetType,
  CollaborationThreadDto,
  CommentStatus,
} from "@retailer-search/shared-types";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

export const ADMIN_COLLABORATION_CHANGED_EVENT = "admin:collaboration-changed";

const inputStyle = {
  padding: "0.45rem 0.6rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 12,
  width: "100%",
  fontFamily: "inherit",
} as const;

interface CommentsPanelProps {
  targetType: CollaborationTargetType;
  targetId: string;
  actorId: string;
  actorLabel: string;
  title?: string;
}

export function CommentsPanel({
  targetType,
  targetId,
  actorId,
  actorLabel,
  title = "Comments",
}: CommentsPanelProps) {
  const [comments, setComments] = useState<CollaborationCommentDto[]>([]);
  const [message, setMessage] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadThread = useCallback(async () => {
    if (!targetId) {
      setComments([]);
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
        `${SEARCH_API_URL}/api/v1/admin/collaboration/thread?${params.toString()}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`Failed to load comments: HTTP ${response.status}`);
      }

      const body = (await response.json()) as CollaborationThreadDto;
      setComments(body.comments);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load comments",
      );
    } finally {
      setLoading(false);
    }
  }, [targetId, targetType]);

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

  const topLevelComments = useMemo(
    () => comments.filter((comment) => !comment.parentCommentId),
    [comments],
  );

  const repliesByParent = useMemo(() => {
    const grouped = new Map<string, CollaborationCommentDto[]>();
    for (const comment of comments) {
      if (!comment.parentCommentId) {
        continue;
      }

      const existing = grouped.get(comment.parentCommentId) ?? [];
      existing.push(comment);
      grouped.set(comment.parentCommentId, existing);
    }
    return grouped;
  }, [comments]);

  const notifyChanged = () => {
    window.dispatchEvent(new CustomEvent(ADMIN_COLLABORATION_CHANGED_EVENT));
  };

  const parseTags = (value: string): string[] | undefined => {
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    return tags.length > 0 ? tags : undefined;
  };

  const addComment = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setError("Comment message is required.");
      return;
    }

    if (!actorId || !actorLabel) {
      setError("Select a reviewer context before commenting.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/collaboration/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType,
            targetId,
            actorId,
            actorLabel,
            message: trimmedMessage,
            parentCommentId: replyToId ?? undefined,
            tags: parseTags(tagsInput),
          }),
        },
      );

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Add comment failed with HTTP ${response.status}`);
      }

      setMessage("");
      setTagsInput("");
      setReplyToId(null);
      await loadThread();
      notifyChanged();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Failed to add comment",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (commentId: string, status: CommentStatus) => {
    setActingOnId(commentId);
    setError(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/collaboration/comments/${commentId}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) {
        throw new Error(`Update status failed with HTTP ${response.status}`);
      }

      await loadThread();
      notifyChanged();
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Failed to update comment status",
      );
    } finally {
      setActingOnId(null);
    }
  };

  const renderComment = (
    comment: CollaborationCommentDto,
    depth = 0,
  ): React.ReactNode => {
    const replies = repliesByParent.get(comment.id) ?? [];

    return (
      <li
        key={comment.id}
        style={{
          padding: "0.6rem",
          marginLeft: depth > 0 ? `${depth}rem` : 0,
          border: `1px solid ${comment.status === "resolved" ? "#e2e8f0" : "#bfdbfe"}`,
          borderRadius: 8,
          background: comment.status === "resolved" ? "#f8fafc" : "#eff6ff",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginBottom: "0.25rem",
            fontSize: 12,
          }}
        >
          <strong>{comment.author.actorLabel}</strong>
          <span style={{ color: "#64748b" }}>
            {new Date(comment.createdAt).toLocaleString()}
          </span>
          <span style={{ color: comment.status === "resolved" ? "#64748b" : "#1d4ed8" }}>
            {comment.status ?? "open"}
          </span>
        </div>

        <p style={{ margin: "0 0 0.35rem", color: "#334155", fontSize: 12 }}>
          {comment.message}
        </p>

        {comment.tags && comment.tags.length > 0 && (
          <p style={{ margin: "0 0 0.35rem", color: "#64748b", fontSize: 11 }}>
            Tags: {comment.tags.join(", ")}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setReplyToId(comment.id)}
            style={{
              padding: "0.25rem 0.5rem",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            Reply
          </button>
          {comment.status === "open" ? (
            <button
              type="button"
              disabled={actingOnId === comment.id}
              onClick={() => void updateStatus(comment.id, "resolved")}
              style={{
                padding: "0.25rem 0.5rem",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                background: "#fff",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              Resolve
            </button>
          ) : (
            <button
              type="button"
              disabled={actingOnId === comment.id}
              onClick={() => void updateStatus(comment.id, "open")}
              style={{
                padding: "0.25rem 0.5rem",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                background: "#fff",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              Reopen
            </button>
          )}
        </div>

        {replies.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              margin: "0.5rem 0 0",
              padding: 0,
              display: "grid",
              gap: "0.45rem",
            }}
          >
            {replies.map((reply) => renderComment(reply, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div
      style={{
        marginTop: "0.65rem",
        padding: "0.75rem",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#fafafa",
      }}
    >
      <strong style={{ fontSize: 13 }}>{title}</strong>

      {error && (
        <p style={{ margin: "0.5rem 0 0", color: "#b91c1c", fontSize: 12 }}>{error}</p>
      )}

      {loading && (
        <p style={{ margin: "0.5rem 0 0", color: "#64748b", fontSize: 12 }}>
          Loading comments...
        </p>
      )}

      {!loading && topLevelComments.length === 0 && (
        <p style={{ margin: "0.5rem 0 0", color: "#94a3b8", fontSize: 12 }}>
          No comments yet.
        </p>
      )}

      {!loading && topLevelComments.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: "0.5rem 0 0",
            padding: 0,
            display: "grid",
            gap: "0.45rem",
          }}
        >
          {topLevelComments.map((comment) => renderComment(comment))}
        </ul>
      )}

      <form
        onSubmit={(event) => void addComment(event)}
        style={{ display: "grid", gap: "0.45rem", marginTop: "0.65rem" }}
      >
        {replyToId && (
          <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>
            Replying to {replyToId}{" "}
            <button
              type="button"
              onClick={() => setReplyToId(null)}
              style={{
                border: "none",
                background: "transparent",
                color: "#1d4ed8",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              cancel
            </button>
          </p>
        )}
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Add review note or feedback..."
          style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
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
            background: "var(--forge-primary)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {saving ? "Saving..." : replyToId ? "Post reply" : "Add comment"}
        </button>
      </form>
    </div>
  );
}
