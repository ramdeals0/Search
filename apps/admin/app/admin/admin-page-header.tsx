import Link from "next/link";
import type { ReactNode, SVGProps } from "react";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}

interface AdminMetricCardProps {
  label: string;
  value: string;
  hint?: string;
}

interface WorkflowStepIndicatorProps {
  steps: readonly string[];
  currentStep: number;
  orientation?: "horizontal" | "vertical";
}

interface WorkflowShellProps {
  title: string;
  description?: string;
  backHref: string;
  backLabel?: string;
  steps: readonly string[];
  currentStep: number;
  children: ReactNode;
  footer?: ReactNode;
  stepLayout?: "horizontal" | "sidebar";
}

export function ForgeOpsLogoMark({
  size = 32,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <rect x="4" y="4" width="24" height="24" rx="6" fill="currentColor" opacity="0.08" />
      <path
        d="M9 10h6v3h-3v9H9V10z"
        fill="currentColor"
      />
      <path
        d="M23 10h-6v3h3v9h3V10z"
        fill="currentColor"
      />
      <path
        d="M12 10h8v2.5H12V10z"
        fill="var(--forge-accent, #2563eb)"
      />
      <path
        d="M14 18h4v4h-4v-4z"
        fill="currentColor"
        opacity="0.35"
      />
    </svg>
  );
}

export function ForgeOpsLogo({
  compact = false,
  showTagline = true,
}: {
  compact?: boolean;
  showTagline?: boolean;
}) {
  return (
    <div className="forge-logo" aria-label="ForgeOps">
      <ForgeOpsLogoMark size={compact ? 28 : 32} style={{ color: "var(--forge-text)" }} />
      {!compact ? (
        <div className="forge-logo__wordmark">
          <span className="forge-logo__name">ForgeOps</span>
          {showTagline ? (
            <span className="forge-logo__tagline">Commerce Operations</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  eyebrow,
  actions,
}: AdminPageHeaderProps) {
  return (
    <header className="forge-page-header">
      <div>
        {eyebrow ? <p className="forge-page-header__eyebrow">{eyebrow}</p> : null}
        <h1 className="forge-page-header__title">{title}</h1>
        {description ? (
          <p className="forge-page-header__description">{description}</p>
        ) : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
    </header>
  );
}

export function AdminMetricCard({ label, value, hint }: AdminMetricCardProps) {
  return (
    <div className="forge-card forge-card--metric">
      <div className="forge-card__label">{label}</div>
      <div className="forge-card__value">{value}</div>
      {hint ? <div className="forge-card__hint">{hint}</div> : null}
    </div>
  );
}

export function WorkflowStepIndicator({
  steps,
  currentStep,
  orientation = "horizontal",
}: WorkflowStepIndicatorProps) {
  const isVertical = orientation === "vertical";

  return (
    <nav
      aria-label="Workflow progress"
      style={{
        display: "flex",
        flexDirection: isVertical ? "column" : "row",
        flexWrap: isVertical ? "nowrap" : "wrap",
        gap: isVertical ? "0.35rem" : "0.5rem",
        marginBottom: isVertical ? 0 : "1.25rem",
      }}
    >
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isComplete = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;

        return (
          <div
            key={step}
            aria-current={isCurrent ? "step" : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: isVertical ? "0.55rem 0.75rem" : "0.45rem 0.75rem",
              borderRadius: isVertical ? "var(--forge-radius-sm)" : 999,
              border: isVertical
                ? "1px solid transparent"
                : `1px solid ${
                    isCurrent
                      ? "var(--forge-accent-border-strong)"
                      : isComplete
                        ? "rgba(21, 128, 61, 0.25)"
                        : "var(--forge-border)"
                  }`,
              borderLeft: isVertical
                ? `3px solid ${
                    isCurrent
                      ? "var(--forge-accent)"
                      : isComplete
                        ? "#15803d"
                        : "transparent"
                  }`
                : undefined,
              background: isVertical
                ? isCurrent
                  ? "var(--forge-accent-subtle)"
                  : isComplete
                    ? "rgba(21, 128, 61, 0.06)"
                    : "transparent"
                : isCurrent
                  ? "var(--forge-accent-subtle)"
                  : isComplete
                    ? "rgba(21, 128, 61, 0.08)"
                    : "var(--forge-surface)",
              color: isCurrent
                ? "var(--forge-accent)"
                : isComplete
                  ? "#15803d"
                  : "var(--forge-text-subtle)",
              fontSize: "0.8125rem",
              fontWeight: isCurrent ? 600 : 500,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "1.25rem",
                height: "1.25rem",
                borderRadius: "50%",
                flexShrink: 0,
                background: isCurrent
                  ? "var(--forge-accent)"
                  : isComplete
                    ? "#15803d"
                    : "var(--forge-surface-muted)",
                color: isCurrent || isComplete ? "#fff" : "var(--forge-text-subtle)",
                fontSize: "0.6875rem",
                fontWeight: 700,
              }}
            >
              {isComplete ? "✓" : stepNumber}
            </span>
            {step}
          </div>
        );
      })}
    </nav>
  );
}

export function WorkflowShell({
  title,
  description,
  backHref,
  backLabel = "Back",
  steps,
  currentStep,
  children,
  footer,
  stepLayout = "horizontal",
}: WorkflowShellProps) {
  const useSidebarSteps = stepLayout === "sidebar";

  return (
    <div className="forge-page-stack--loose">
      <Link
        href={backHref}
        className="forge-quick-link"
        style={{
          display: "inline-block",
          width: "fit-content",
          padding: "0.5rem 0.85rem",
          marginBottom: "0.25rem",
        }}
      >
        <span className="forge-quick-link__title">{backLabel}</span>
      </Link>

      <AdminPageHeader
        eyebrow="Workflow"
        title={title}
        description={description}
      />

      {useSidebarSteps ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(11rem, 14rem) minmax(0, 1fr)",
            gap: "1rem",
            alignItems: "start",
          }}
        >
          <aside
            className="forge-card forge-card--panel"
            aria-label="Workflow steps"
            style={{ position: "sticky", top: "1rem" }}
          >
            <p
              style={{
                margin: "0 0 0.75rem",
                fontSize: "0.6875rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--forge-text-subtle)",
              }}
            >
              Guided steps
            </p>
            <WorkflowStepIndicator
              steps={steps}
              currentStep={currentStep}
              orientation="vertical"
            />
          </aside>

          <div style={{ display: "grid", gap: "0.75rem", minWidth: 0 }}>
            <div className="forge-card forge-card--panel">{children}</div>
            {footer ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <WorkflowStepIndicator steps={steps} currentStep={currentStep} />
          <div className="forge-card forge-card--panel">{children}</div>
          {footer ? (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              {footer}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function workflowButtonStyle(variant: "primary" | "secondary" = "primary") {
  return {
    padding: "0.55rem 0.95rem",
    borderRadius: 6,
    border: variant === "secondary" ? "1px solid var(--forge-border)" : "none",
    background: variant === "primary" ? "var(--forge-primary)" : "var(--forge-surface)",
    color: variant === "primary" ? "#fff" : "var(--forge-text)",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  } as const;
}

export const workflowInputStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
} as const;
