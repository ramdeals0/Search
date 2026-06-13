"use client";
import { getSearchApiUrl } from "./lib/search-api-url";

import { useCallback, useEffect, useState } from "react";
import type {
  CreateExportJobRequestDto,
  ExportFormat,
  ExportJobDto,
  ExportJobListResponseDto,
  ExportTargetType,
} from "@retailer-search/shared-types";
import {
  AUTH_TOKEN_STORAGE_KEY,
  ACCESS_GOVERNANCE_CHANGED_EVENT,
} from "./access-request-panel";

export const INTEGRATIONS_CHANGED_EVENT = "admin:integrations-changed";

const panelStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "1rem",
  background: "#fff",
} as const;

const inputStyle = {
  padding: "0.45rem 0.6rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 13,
  width: "100%",
} as const;

const TARGET_OPTIONS: Array<{ value: ExportTargetType; label: string }> = [
  { value: "audit_trail", label: "Audit trail" },
  { value: "approvals", label: "Approvals" },
  { value: "access_reviews", label: "Access reviews" },
  { value: "security_timeline", label: "Security timeline" },
  { value: "audit_review_findings", label: "Audit review findings" },
];

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
      : null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function ExportCenterPanel() {
  const [jobs, setJobs] = useState<ExportJobDto[]>([]);
  const [targetType, setTargetType] = useState<ExportTargetType>("audit_trail");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [filterKeyword, setFilterKeyword] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/exports`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to load exports (HTTP ${response.status})`);
      }

      const body = (await response.json()) as ExportJobListResponseDto;
      setJobs(body.jobs);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load export jobs",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    const handler = () => {
      void loadJobs();
    };
    window.addEventListener(INTEGRATIONS_CHANGED_EVENT, handler);
    window.addEventListener(ACCESS_GOVERNANCE_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(INTEGRATIONS_CHANGED_EVENT, handler);
      window.removeEventListener(ACCESS_GOVERNANCE_CHANGED_EVENT, handler);
    };
  }, [loadJobs]);

  const buildFilters = (): Record<string, unknown> | undefined => {
    const filters: Record<string, unknown> = {};

    if (targetType === "audit_trail" && filterKeyword.trim()) {
      filters.keyword = filterKeyword.trim();
    }
    if (targetType === "approvals" && filterStatus.trim()) {
      filters.status = filterStatus.trim();
    }
    if (targetType === "security_timeline") {
      if (filterCategory.trim()) {
        filters.category = filterCategory.trim();
      }
      if (filterSeverity.trim()) {
        filters.severity = filterSeverity.trim();
      }
    }

    return Object.keys(filters).length > 0 ? filters : undefined;
  };

  const createExport = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setFeedback(null);

    const payload: CreateExportJobRequestDto = {
      targetType,
      format,
      filters: buildFilters(),
    };

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/exports`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as
        | ExportJobDto
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          body && "error" in body
            ? body.error
            : `Export failed with HTTP ${response.status}`,
        );
      }

      setFeedback(`Export job ${(body as ExportJobDto).id} generated.`);
      window.dispatchEvent(new CustomEvent(INTEGRATIONS_CHANGED_EVENT));
      await loadJobs();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Failed to create export",
      );
    } finally {
      setCreating(false);
    }
  };

  const downloadExport = async (job: ExportJobDto) => {
    setDownloadingId(job.id);
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/exports/${job.id}/download`,
        {
          headers: getAuthHeaders(),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Download failed with HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = job.fileName ?? `${job.targetType}.${job.format}`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      window.dispatchEvent(new CustomEvent(INTEGRATIONS_CHANGED_EVENT));
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download export",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section id="export-center" style={panelStyle}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Export Center</h2>
      <p style={{ marginTop: 0, color: "#475569", fontSize: 13 }}>
        Generate audit-friendly evidence exports for investigations, reviews, and
        compliance handoffs.
      </p>

      {loading ? <p style={{ fontSize: 13 }}>Loading export jobs…</p> : null}
      {error ? (
        <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</p>
      ) : null}
      {feedback ? (
        <p style={{ color: "#047857", fontSize: 13, marginBottom: 12 }}>{feedback}</p>
      ) : null}

      <form
        onSubmit={createExport}
        style={{
          display: "grid",
          gap: 10,
          marginBottom: 16,
          paddingBottom: 16,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>Create export</div>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Target
          <select
            value={targetType}
            onChange={(event) => setTargetType(event.target.value as ExportTargetType)}
            style={inputStyle}
          >
            {TARGET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Format
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as ExportFormat)}
            style={inputStyle}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </label>

        {targetType === "audit_trail" ? (
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Keyword filter (optional)
            <input
              value={filterKeyword}
              onChange={(event) => setFilterKeyword(event.target.value)}
              placeholder="Search audit summaries"
              style={inputStyle}
            />
          </label>
        ) : null}

        {targetType === "approvals" ? (
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Status filter (optional)
            <input
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              placeholder="pending, approved, rejected, executed"
              style={inputStyle}
            />
          </label>
        ) : null}

        {targetType === "security_timeline" ? (
          <>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Category filter (optional)
              <input
                value={filterCategory}
                onChange={(event) => setFilterCategory(event.target.value)}
                placeholder="authentication, approval, jit_access"
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Severity filter (optional)
              <select
                value={filterSeverity}
                onChange={(event) => setFilterSeverity(event.target.value)}
                style={inputStyle}
              >
                <option value="">All severities</option>
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="critical">critical</option>
              </select>
            </label>
          </>
        ) : null}

        <button
          type="submit"
          disabled={creating}
          style={{
            width: "fit-content",
            padding: "0.45rem 0.85rem",
            borderRadius: 6,
            border: "1px solid #334155",
            background: "var(--forge-primary)",
            color: "#fff",
            cursor: creating ? "wait" : "pointer",
            fontSize: 13,
          }}
        >
          {creating ? "Generating…" : "Generate export"}
        </button>
      </form>

      <div style={{ display: "grid", gap: 10 }}>
        {jobs.length === 0 && !loading ? (
          <p style={{ fontSize: 13, color: "#64748b" }}>No export jobs yet.</p>
        ) : null}

        {jobs.map((job) => (
          <article
            key={job.id}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              padding: "0.75rem",
              background: "#f8fafc",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <strong style={{ fontSize: 14 }}>{job.fileName ?? job.id}</strong>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {job.targetType} · {job.format.toUpperCase()} · {job.createdByName}
                </div>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: job.status === "generated" ? "#047857" : "#b91c1c",
                }}
              >
                {job.status}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
              Created {new Date(job.createdAt).toLocaleString()}
              {job.recordCount !== undefined ? ` · ${job.recordCount} records` : ""}
            </div>
            {job.errorMessage ? (
              <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 4 }}>
                {job.errorMessage}
              </div>
            ) : null}
            {job.status === "generated" ? (
              <button
                type="button"
                disabled={downloadingId === job.id}
                onClick={() => void downloadExport(job)}
                style={{
                  marginTop: 8,
                  padding: "0.35rem 0.7rem",
                  fontSize: 12,
                  borderRadius: 6,
                  border: "1px solid #2563eb",
                  background: "#eff6ff",
                  cursor: downloadingId === job.id ? "wait" : "pointer",
                }}
              >
                {downloadingId === job.id ? "Downloading…" : "Download"}
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
