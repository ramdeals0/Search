"use client";
import { getSearchApiUrl } from "../../../../lib/search-api-url";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApprovalListResponseDto,
  ApprovalRequestDto,
  EnvironmentConfigurationDto,
  MerchandisingRule,
} from "@retailer-search/shared-types";
import {
  WorkflowShell,
  workflowButtonStyle,
  workflowInputStyle,
} from "../../../admin-page-header";

const STEPS = [
  "Review staged changes",
  "Compare staging vs live",
  "Confirm approvals",
  "Publish",
] as const;

function summarizeRules(rules: MerchandisingRule[]): string {
  const active = rules.filter((rule) => rule.active).length;
  return `${rules.length} total · ${active} active`;
}

export default function PublishWorkflowPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [stagingRules, setStagingRules] = useState<MerchandisingRule[]>([]);
  const [liveRules, setLiveRules] = useState<MerchandisingRule[]>([]);
  const [environments, setEnvironments] = useState<EnvironmentConfigurationDto[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequestDto[]>([]);
  const [promoteReason, setPromoteReason] = useState(
    "Approved staging changes ready for live search.",
  );
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [stagingRes, liveRes, envRes, approvalsRes] = await Promise.all([
        fetch(`${getSearchApiUrl()}/api/v1/admin/rules?environment=staging`, {
          cache: "no-store",
        }),
        fetch(`${getSearchApiUrl()}/api/v1/admin/rules?environment=live`, {
          cache: "no-store",
        }),
        fetch(`${getSearchApiUrl()}/api/v1/admin/environments`, { cache: "no-store" }),
        fetch(`${getSearchApiUrl()}/api/v1/admin/approvals`, { cache: "no-store" }),
      ]);

      setStagingRules(
        stagingRes.ok ? ((await stagingRes.json()) as MerchandisingRule[]) : [],
      );
      setLiveRules(liveRes.ok ? ((await liveRes.json()) as MerchandisingRule[]) : []);

      if (envRes.ok) {
        const payload = (await envRes.json()) as {
          environments: EnvironmentConfigurationDto[];
        };
        setEnvironments(payload.environments ?? []);
      } else {
        setEnvironments([]);
      }

      if (approvalsRes.ok) {
        const payload = (await approvalsRes.json()) as ApprovalListResponseDto;
        setApprovals(payload.requests ?? []);
      } else {
        setApprovals([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load publish data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const staging = environments.find((item) => item.environment === "staging");
  const live = environments.find((item) => item.environment === "live");
  const pendingApprovals = approvals.filter((request) => request.status === "pending");
  const approvedAwaitingExecution = approvals.filter(
    (request) => request.status === "approved",
  );
  const stagedDelta =
    Math.abs(stagingRules.length - liveRules.length) +
    Math.abs((staging?.counts.synonyms ?? 0) - (live?.counts.synonyms ?? 0));

  const canAdvance = useMemo(() => {
    if (step === 4) {
      return promoteReason.trim().length > 0;
    }
    return true;
  }, [promoteReason, step]);

  const publishStagingToLive = async () => {
    setPublishing(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/environments/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromEnvironment: "staging",
          toEnvironment: "live",
          reason: promoteReason.trim(),
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? `Publish failed with HTTP ${response.status}`);
      }

      setFeedback(body?.message ?? "Staging promoted to live.");
      window.dispatchEvent(new CustomEvent("admin:active-config-changed"));
      window.dispatchEvent(new CustomEvent("admin:environment-changed"));
      window.setTimeout(() => {
        router.push("/admin/merchandising");
        router.refresh();
      }, 900);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const stepContent = (() => {
    if (loading) {
      return (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Loading staging rules, environments, and approvals...
        </p>
      );
    }

    switch (step) {
      case 1:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Review what is currently staged before comparing against live.
            </p>
            <div
              style={{
                padding: "0.75rem",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                fontSize: 13,
              }}
            >
              <strong>Staging rules</strong>
              <div style={{ marginTop: 6 }}>{summarizeRules(stagingRules)}</div>
              <div style={{ marginTop: 6, color: "#64748b" }}>
                Estimated staged delta vs live: {stagedDelta}
              </div>
            </div>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: 13, color: "#475569" }}>
              {stagingRules.slice(0, 8).map((rule) => (
                <li key={rule.id}>
                  {rule.name} · {rule.action} · {rule.active ? "active" : "inactive"}
                </li>
              ))}
              {stagingRules.length > 8 ? (
                <li>…and {stagingRules.length - 8} more</li>
              ) : null}
            </ul>
          </div>
        );
      case 2:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Side-by-side environment summary before publish.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "0.75rem",
              }}
            >
              <EnvironmentCard title="Live" config={live} rules={liveRules} />
              <EnvironmentCard title="Staging" config={staging} rules={stagingRules} />
            </div>
          </div>
        );
      case 3:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Confirm governance posture. Pending approvals should be cleared or executed before
              emergency direct publish.
            </p>
            <div
              style={{
                padding: "0.75rem",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                fontSize: 13,
              }}
            >
              <div>Pending approvals: {pendingApprovals.length}</div>
              <div style={{ marginTop: 4 }}>
                Approved awaiting execution: {approvedAwaitingExecution.length}
              </div>
            </div>
            {pendingApprovals.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: 13, color: "#475569" }}>
                {pendingApprovals.slice(0, 5).map((request) => (
                  <li key={request.id}>
                    {request.snapshotName ?? request.snapshotId} · {request.status}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "#15803d" }}>
                No pending approval requests blocking review.
              </p>
            )}
          </div>
        );
      case 4:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Promote staging rules and synonyms to live search immediately.
            </p>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Publish reason
              <textarea
                value={promoteReason}
                onChange={(event) => setPromoteReason(event.target.value)}
                style={{ ...workflowInputStyle, minHeight: 72, resize: "vertical" }}
              />
            </label>
            {error ? (
              <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p>
            ) : null}
            {feedback ? (
              <p style={{ margin: 0, color: "#15803d", fontSize: 14 }}>{feedback}</p>
            ) : null}
            <button
              type="button"
              disabled={publishing || Boolean(feedback)}
              onClick={() => void publishStagingToLive()}
              style={workflowButtonStyle("primary")}
            >
              {publishing ? "Publishing..." : feedback ? "Published" : "Publish staging to live"}
            </button>
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <WorkflowShell
      title="Publish staging"
      description="Four-step release review before staging configuration replaces live search."
      backHref="/admin/merchandising"
      backLabel="← Merchandising overview"
      steps={STEPS}
      currentStep={step}
      footer={
        <>
          <button
            type="button"
            disabled={step === 1 || loading}
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            style={workflowButtonStyle("secondary")}
          >
            Back
          </button>
          {step < STEPS.length ? (
            <button
              type="button"
              disabled={!canAdvance || loading}
              onClick={() => setStep((current) => Math.min(STEPS.length, current + 1))}
              style={workflowButtonStyle("primary")}
            >
              Continue
            </button>
          ) : null}
        </>
      }
    >
      {stepContent}
    </WorkflowShell>
  );
}

function EnvironmentCard(props: {
  title: string;
  config?: EnvironmentConfigurationDto;
  rules: MerchandisingRule[];
}) {
  return (
    <div
      style={{
        padding: "0.75rem",
        borderRadius: 8,
        border: "1px solid #e2e8f0",
        background: "#fff",
        fontSize: 13,
      }}
    >
      <strong>{props.title}</strong>
      {props.config ? (
        <>
          <div style={{ marginTop: 6, color: "#475569" }}>
            {props.config.snapshotName
              ? `Snapshot: ${props.config.snapshotName}`
              : "No linked snapshot"}
          </div>
          <div style={{ marginTop: 4, color: "#64748b" }}>
            {props.config.counts.rules} rules · {props.config.counts.synonyms} synonyms
          </div>
          <div style={{ marginTop: 4, color: "#64748b" }}>
            Updated {new Date(props.config.updatedAt).toLocaleString()}
          </div>
        </>
      ) : (
        <div style={{ marginTop: 6, color: "#64748b" }}>Environment unavailable</div>
      )}
      <div style={{ marginTop: 8 }}>{summarizeRules(props.rules)}</div>
    </div>
  );
}
