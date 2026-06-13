"use client";
import { getSearchApiUrl } from "../lib/search-api-url";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BootstrapStateDto,
  ConfigureBootstrapPlatformRequestDto,
  ConfigureBootstrapSecurityRequestDto,
  CreateBootstrapAdminRequestDto,
} from "@retailer-search/shared-types";
import { AUTH_TOKEN_STORAGE_KEY, persistAuthSession } from "../auth-session";

const STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "create_admin", label: "First admin" },
  { id: "security", label: "Security" },
  { id: "platform", label: "Platform" },
  { id: "review", label: "Review" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const DEFAULT_SECURITY: ConfigureBootstrapSecurityRequestDto = {
  passwordMinLength: 12,
  loginAttemptLimit: 5,
  lockoutWindowMinutes: 15,
  sessionTtlHours: 12,
  auditLoggingEnabled: true,
};

const DEFAULT_PLATFORM: ConfigureBootstrapPlatformRequestDto = {
  instanceName: process.env.NEXT_PUBLIC_APP_NAME ?? "Retail Discovery Platform",
  stagingEnvironmentLabel: "staging",
  liveEnvironmentLabel: "live",
  requireApprovalForLivePromotion: true,
  jitEnabled: true,
  defaultJitDurationMinutes: 30,
  accessReviewCadenceDays: 90,
  defaultWorkspaceRole: "admin",
};

function maxAllowedStepForStatus(status: BootstrapStateDto["status"]): StepId {
  switch (status) {
    case "not_started":
      return "create_admin";
    case "admin_created":
      return "security";
    case "security_configured":
      return "platform";
    case "platform_configured":
    case "completed":
      return "review";
  }
}

function stepIndex(step: StepId): number {
  return STEPS.findIndex((entry) => entry.id === step);
}

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

interface SetupWizardProps {
  initialState: BootstrapStateDto;
}

export function SetupWizard({ initialState }: SetupWizardProps) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [activeStep, setActiveStep] = useState<StepId>(() => {
    if (initialState.status === "not_started") {
      return "welcome";
    }
    return maxAllowedStepForStatus(initialState.status);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adminForm, setAdminForm] = useState<CreateBootstrapAdminRequestDto>({
    name: "Platform Admin",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [securityForm, setSecurityForm] =
    useState<ConfigureBootstrapSecurityRequestDto>(DEFAULT_SECURITY);
  const [platformForm, setPlatformForm] =
    useState<ConfigureBootstrapPlatformRequestDto>(DEFAULT_PLATFORM);

  const maxAllowedStep = useMemo(
    () => stepIndex(maxAllowedStepForStatus(state.status)),
    [state.status],
  );
  const currentStepIndex = stepIndex(activeStep);

  const canOpenStep = (step: StepId): boolean => stepIndex(step) <= maxAllowedStep;

  const goToStep = (step: StepId) => {
    if (!canOpenStep(step)) {
      return;
    }
    setError(null);
    setActiveStep(step);
  };

  const parseApiError = async (response: Response): Promise<string> => {
    try {
      const body = (await response.json()) as { message?: string };
      return body.message ?? `Request failed with HTTP ${response.status}`;
    } catch {
      return `Request failed with HTTP ${response.status}`;
    }
  };

  const createAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    if (adminForm.password !== adminForm.confirmPassword) {
      setError("Password and confirmation do not match.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/setup/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adminForm),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const body = (await response.json()) as {
        session?: { token: string };
      };

      if (body.session?.token) {
        persistAuthSession(body.session.token);
      }

      const statusResponse = await fetch(`${getSearchApiUrl()}/api/v1/setup/status`, {
        cache: "no-store",
      });
      const nextState = (await statusResponse.json()) as BootstrapStateDto;
      setState(nextState);
      setActiveStep("security");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to create admin",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const saveSecurity = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/setup/security`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(securityForm),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const nextState = (await response.json()) as BootstrapStateDto;
      setState(nextState);
      setActiveStep("platform");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to save security defaults",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const savePlatform = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/setup/platform`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(platformForm),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const nextState = (await response.json()) as BootstrapStateDto;
      setState(nextState);
      setActiveStep("review");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to save platform defaults",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const completeSetup = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/setup/complete`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ confirm: true }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      router.push("/login");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to complete setup",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 10,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))`,
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        {STEPS.map((step, index) => {
          const enabled = canOpenStep(step.id);
          const isActive = step.id === activeStep;
          const isComplete = index < maxAllowedStep;

          return (
            <button
              key={step.id}
              type="button"
              disabled={!enabled}
              onClick={() => goToStep(step.id)}
              style={{
                border: "none",
                borderRight: index < STEPS.length - 1 ? "1px solid #e2e8f0" : undefined,
                background: isActive ? "#fff" : "transparent",
                padding: "0.75rem 0.5rem",
                cursor: enabled ? "pointer" : "not-allowed",
                opacity: enabled ? 1 : 0.55,
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                color: isComplete ? "#166534" : "#334155",
              }}
            >
              {index + 1}. {step.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "1.25rem 1.5rem" }}>
        {error ? (
          <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 0 }}>{error}</p>
        ) : null}

        {activeStep === "welcome" ? (
          <div>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Welcome</h2>
            <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
              This deployment has not been initialized yet. You will create the first
              admin account, apply secure defaults, and confirm platform governance
              settings before normal sign-in is enabled.
            </p>
            <button
              type="button"
              onClick={() => goToStep("create_admin")}
              style={primaryButtonStyle}
            >
              Start setup
            </button>
          </div>
        ) : null}

        {activeStep === "create_admin" ? (
          <form onSubmit={createAdmin} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Create first admin</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
              This account becomes the bootstrap administrator for this instance.
            </p>
            <label style={labelStyle}>
              Name
              <input
                required
                value={adminForm.name}
                onChange={(event) =>
                  setAdminForm((current) => ({ ...current, name: event.target.value }))
                }
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Email
              <input
                required
                type="email"
                value={adminForm.email}
                onChange={(event) =>
                  setAdminForm((current) => ({ ...current, email: event.target.value }))
                }
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Password
              <input
                required
                type="password"
                minLength={8}
                value={adminForm.password}
                onChange={(event) =>
                  setAdminForm((current) => ({ ...current, password: event.target.value }))
                }
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Confirm password
              <input
                required
                type="password"
                minLength={8}
                value={adminForm.confirmPassword}
                onChange={(event) =>
                  setAdminForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>
            <button type="submit" disabled={submitting} style={primaryButtonStyle}>
              {submitting ? "Creating admin…" : "Create admin and continue"}
            </button>
          </form>
        ) : null}

        {activeStep === "security" ? (
          <form onSubmit={saveSecurity} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Security defaults</h2>
            <label style={labelStyle}>
              Minimum password length
              <input
                required
                type="number"
                min={8}
                value={securityForm.passwordMinLength}
                onChange={(event) =>
                  setSecurityForm((current) => ({
                    ...current,
                    passwordMinLength: Number(event.target.value),
                  }))
                }
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Login attempt limit
              <input
                required
                type="number"
                min={1}
                value={securityForm.loginAttemptLimit}
                onChange={(event) =>
                  setSecurityForm((current) => ({
                    ...current,
                    loginAttemptLimit: Number(event.target.value),
                  }))
                }
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Lockout window (minutes)
              <input
                required
                type="number"
                min={1}
                value={securityForm.lockoutWindowMinutes}
                onChange={(event) =>
                  setSecurityForm((current) => ({
                    ...current,
                    lockoutWindowMinutes: Number(event.target.value),
                  }))
                }
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Session TTL (hours)
              <input
                required
                type="number"
                min={1}
                value={securityForm.sessionTtlHours}
                onChange={(event) =>
                  setSecurityForm((current) => ({
                    ...current,
                    sessionTtlHours: Number(event.target.value),
                  }))
                }
                style={inputStyle}
              />
            </label>
            <label style={{ ...labelStyle, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={securityForm.auditLoggingEnabled}
                onChange={(event) =>
                  setSecurityForm((current) => ({
                    ...current,
                    auditLoggingEnabled: event.target.checked,
                  }))
                }
              />
              Enable audit logging
            </label>
            <button type="submit" disabled={submitting} style={primaryButtonStyle}>
              {submitting ? "Saving…" : "Save security defaults"}
            </button>
          </form>
        ) : null}

        {activeStep === "platform" ? (
          <form onSubmit={savePlatform} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Platform defaults</h2>
            <label style={labelStyle}>
              Instance name
              <input
                required
                value={platformForm.instanceName}
                onChange={(event) =>
                  setPlatformForm((current) => ({
                    ...current,
                    instanceName: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Staging label
              <input
                required
                value={platformForm.stagingEnvironmentLabel}
                onChange={(event) =>
                  setPlatformForm((current) => ({
                    ...current,
                    stagingEnvironmentLabel: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Live label
              <input
                required
                value={platformForm.liveEnvironmentLabel}
                onChange={(event) =>
                  setPlatformForm((current) => ({
                    ...current,
                    liveEnvironmentLabel: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>
            <label style={{ ...labelStyle, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={platformForm.requireApprovalForLivePromotion}
                onChange={(event) =>
                  setPlatformForm((current) => ({
                    ...current,
                    requireApprovalForLivePromotion: event.target.checked,
                  }))
                }
              />
              Require approval for live promotion
            </label>
            <label style={{ ...labelStyle, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={platformForm.jitEnabled}
                onChange={(event) =>
                  setPlatformForm((current) => ({
                    ...current,
                    jitEnabled: event.target.checked,
                  }))
                }
              />
              Enable JIT elevation
            </label>
            <label style={labelStyle}>
              Default JIT duration (minutes)
              <input
                required
                type="number"
                min={1}
                value={platformForm.defaultJitDurationMinutes}
                onChange={(event) =>
                  setPlatformForm((current) => ({
                    ...current,
                    defaultJitDurationMinutes: Number(event.target.value),
                  }))
                }
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Access review cadence (days)
              <input
                required
                type="number"
                min={1}
                value={platformForm.accessReviewCadenceDays}
                onChange={(event) =>
                  setPlatformForm((current) => ({
                    ...current,
                    accessReviewCadenceDays: Number(event.target.value),
                  }))
                }
                style={inputStyle}
              />
            </label>
            <button type="submit" disabled={submitting} style={primaryButtonStyle}>
              {submitting ? "Saving…" : "Save platform defaults"}
            </button>
          </form>
        ) : null}

        {activeStep === "review" ? (
          <div style={{ display: "grid", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Review and complete</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
              Confirm the settings below. Completing setup enables normal admin sign-in
              and locks further bootstrap changes.
            </p>
            <div style={summaryBoxStyle}>
              <strong>Admin</strong>
              <div>{(state.firstAdminEmail ?? adminForm.email) || "Not set"}</div>
            </div>
            <div style={summaryBoxStyle}>
              <strong>Security</strong>
              <div>Password min length: {securityForm.passwordMinLength}</div>
              <div>Login attempts: {securityForm.loginAttemptLimit}</div>
              <div>Lockout window: {securityForm.lockoutWindowMinutes} min</div>
              <div>Session TTL: {securityForm.sessionTtlHours} h</div>
              <div>
                Audit logging: {securityForm.auditLoggingEnabled ? "enabled" : "disabled"}
              </div>
            </div>
            <div style={summaryBoxStyle}>
              <strong>Platform</strong>
              <div>Instance: {platformForm.instanceName}</div>
              <div>
                Environments: {platformForm.stagingEnvironmentLabel} /{" "}
                {platformForm.liveEnvironmentLabel}
              </div>
              <div>
                Live promotion approval:{" "}
                {platformForm.requireApprovalForLivePromotion ? "required" : "not required"}
              </div>
              <div>JIT enabled: {platformForm.jitEnabled ? "yes" : "no"}</div>
              <div>Default JIT duration: {platformForm.defaultJitDurationMinutes} min</div>
              <div>Access review cadence: {platformForm.accessReviewCadenceDays} days</div>
            </div>
            <button
              type="button"
              disabled={submitting || state.status !== "platform_configured"}
              onClick={() => void completeSetup()}
              style={primaryButtonStyle}
            >
              {submitting ? "Completing setup…" : "Complete setup"}
            </button>
            {state.status !== "platform_configured" ? (
              <p style={{ margin: 0, color: "#b45309", fontSize: 12 }}>
                Finish the platform step before completing setup.
              </p>
            ) : null}
          </div>
        ) : null}

        <p style={{ marginBottom: 0, marginTop: 20, color: "#94a3b8", fontSize: 12 }}>
          Step {currentStepIndex + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  width: "fit-content",
  padding: "0.5rem 0.9rem",
  borderRadius: 6,
  border: "1px solid #334155",
  background: "var(--forge-primary)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "0.45rem 0.6rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  fontSize: 13,
  color: "#334155",
};

const summaryBoxStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "0.75rem 0.9rem",
  fontSize: 13,
  color: "#334155",
  display: "grid",
  gap: 4,
};
