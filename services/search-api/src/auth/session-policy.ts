import type { ConfigureBootstrapSecurityRequestDto } from "@retailer-search/shared-types";

export interface SessionPolicyConfig {
  absoluteTtlHours: number;
  inactivityMinutes: number;
  warningMinutes: number;
}

export type SessionExpiryReason = "absolute" | "inactivity" | null;

export interface SessionTiming {
  createdAt: Date;
  lastActivityAt: Date;
  absoluteExpiresAt: Date;
  inactivityExpiresAt: Date;
  expiresAt: Date;
  reason: SessionExpiryReason;
}

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw?.trim()) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function defaultSessionPolicyConfig(): SessionPolicyConfig {
  return {
    absoluteTtlHours: readEnvInt("SESSION_TTL_HOURS", 8),
    inactivityMinutes: readEnvInt("SESSION_INACTIVITY_MINUTES", 30),
    warningMinutes: readEnvInt("SESSION_WARNING_MINUTES", 5),
  };
}

export function sessionPolicyFromSecurity(
  security: ConfigureBootstrapSecurityRequestDto,
): SessionPolicyConfig {
  const defaults = defaultSessionPolicyConfig();
  return {
    absoluteTtlHours: security.sessionTtlHours,
    inactivityMinutes:
      security.sessionInactivityMinutes ?? defaults.inactivityMinutes,
    warningMinutes: defaults.warningMinutes,
  };
}

export function computeSessionTiming(
  createdAt: Date,
  lastActivityAt: Date,
  policy: SessionPolicyConfig,
  now: Date = new Date(),
): SessionTiming {
  const absoluteExpiresAt = new Date(
    createdAt.getTime() + policy.absoluteTtlHours * 60 * 60 * 1000,
  );
  const inactivityExpiresAt = new Date(
    lastActivityAt.getTime() + policy.inactivityMinutes * 60 * 1000,
  );
  const expiresAt =
    absoluteExpiresAt.getTime() <= inactivityExpiresAt.getTime()
      ? absoluteExpiresAt
      : inactivityExpiresAt;

  let reason: SessionExpiryReason = null;
  if (now.getTime() >= expiresAt.getTime()) {
    reason =
      absoluteExpiresAt.getTime() <= now.getTime() ? "absolute" : "inactivity";
  }

  return {
    createdAt,
    lastActivityAt,
    absoluteExpiresAt,
    inactivityExpiresAt,
    expiresAt,
    reason,
  };
}

let cachedPolicy: SessionPolicyConfig | null = null;

export function setSessionPolicyCache(policy: SessionPolicyConfig): void {
  cachedPolicy = policy;
}

export function getSessionPolicySync(): SessionPolicyConfig {
  return cachedPolicy ?? defaultSessionPolicyConfig();
}
