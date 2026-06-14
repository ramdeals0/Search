import type { ConfigureBootstrapSecurityRequestDto } from "@retailer-search/shared-types";

export interface LoginProtectionConfig {
  maxFailedAttempts: number;
  lockoutWindowMinutes: number;
  maxLockoutMinutes: number;
}

export interface AccountLockStatus {
  locked: boolean;
  lockedUntil?: string;
  retryAfterSeconds?: number;
  failedAttempts?: number;
  remainingAttempts?: number;
}

interface AccountLoginState {
  consecutiveFailures: number;
  lockedUntilMs: number | null;
  lockoutTier: number;
}

const accountStates = new Map<string, AccountLoginState>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw?.trim()) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function defaultLoginProtectionConfig(): LoginProtectionConfig {
  return {
    maxFailedAttempts: readEnvInt(
      "AUTH_LOGIN_ATTEMPT_LIMIT",
      readEnvInt("RATE_LIMIT_AUTH_LOGIN_LIMIT", 5),
    ),
    lockoutWindowMinutes: readEnvInt("AUTH_LOCKOUT_WINDOW_MINUTES", 15),
    maxLockoutMinutes: readEnvInt("AUTH_MAX_LOCKOUT_MINUTES", 24 * 60),
  };
}

export function loginProtectionConfigFromSecurity(
  security: ConfigureBootstrapSecurityRequestDto,
): LoginProtectionConfig {
  return {
    maxFailedAttempts: security.loginAttemptLimit,
    lockoutWindowMinutes: security.lockoutWindowMinutes,
    maxLockoutMinutes: readEnvInt("AUTH_MAX_LOCKOUT_MINUTES", 24 * 60),
  };
}

function getAccountState(email: string): AccountLoginState {
  const key = normalizeEmail(email);
  const existing = accountStates.get(key);
  if (existing) {
    return existing;
  }

  const created: AccountLoginState = {
    consecutiveFailures: 0,
    lockedUntilMs: null,
    lockoutTier: 0,
  };
  accountStates.set(key, created);
  return created;
}

function computeLockoutDurationMs(
  config: LoginProtectionConfig,
  lockoutTier: number,
): number {
  const baseMs = config.lockoutWindowMinutes * 60 * 1000;
  const multiplier = Math.max(1, 2 ** Math.max(0, lockoutTier));
  const cappedMs = Math.min(baseMs * multiplier, config.maxLockoutMinutes * 60 * 1000);
  return cappedMs;
}

export function getAccountLockStatus(
  email: string,
  config: LoginProtectionConfig = defaultLoginProtectionConfig(),
  now: Date = new Date(),
): AccountLockStatus {
  const state = getAccountState(email);
  const nowMs = now.getTime();

  if (state.lockedUntilMs && nowMs >= state.lockedUntilMs) {
    state.lockedUntilMs = null;
  }

  if (state.lockedUntilMs && nowMs < state.lockedUntilMs) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((state.lockedUntilMs - nowMs) / 1000),
    );
    return {
      locked: true,
      lockedUntil: new Date(state.lockedUntilMs).toISOString(),
      retryAfterSeconds,
      failedAttempts: state.consecutiveFailures,
    };
  }

  return {
    locked: false,
    failedAttempts: state.consecutiveFailures,
    remainingAttempts: Math.max(0, config.maxFailedAttempts - state.consecutiveFailures),
  };
}

export function recordFailedLoginAttempt(
  email: string,
  config: LoginProtectionConfig = defaultLoginProtectionConfig(),
  now: Date = new Date(),
): AccountLockStatus {
  const state = getAccountState(email);
  const nowMs = now.getTime();

  const current = getAccountLockStatus(email, config, now);
  if (current.locked) {
    return current;
  }

  state.consecutiveFailures += 1;

  if (state.consecutiveFailures >= config.maxFailedAttempts) {
    const lockoutMs = computeLockoutDurationMs(config, state.lockoutTier);
    state.lockedUntilMs = nowMs + lockoutMs;
    state.lockoutTier += 1;
    state.consecutiveFailures = 0;

    return {
      locked: true,
      lockedUntil: new Date(state.lockedUntilMs).toISOString(),
      retryAfterSeconds: Math.max(1, Math.ceil(lockoutMs / 1000)),
      failedAttempts: config.maxFailedAttempts,
    };
  }

  return {
    locked: false,
    failedAttempts: state.consecutiveFailures,
    remainingAttempts: config.maxFailedAttempts - state.consecutiveFailures,
  };
}

export function clearLoginFailures(email: string): void {
  accountStates.delete(normalizeEmail(email));
}

export function cleanupExpiredLoginProtectionEntries(now: Date = new Date()): number {
  const nowMs = now.getTime();
  let removed = 0;

  for (const [email, state] of accountStates.entries()) {
    const lockExpired = !state.lockedUntilMs || nowMs >= state.lockedUntilMs;
    if (lockExpired && state.consecutiveFailures === 0 && state.lockoutTier === 0) {
      accountStates.delete(email);
      removed += 1;
    } else if (state.lockedUntilMs && nowMs >= state.lockedUntilMs) {
      state.lockedUntilMs = null;
    }
  }

  return removed;
}

export function buildAccountLockoutMessage(retryAfterSeconds?: number): string {
  if (!retryAfterSeconds || retryAfterSeconds <= 60) {
    return "Account temporarily locked due to too many failed login attempts. Please try again shortly.";
  }

  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Account temporarily locked due to too many failed login attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
