import type { RateLimitStatusDto } from "@retailer-search/shared-types";

interface RateLimitEntry {
  count: number;
  windowStartMs: number;
}

const entries = new Map<string, RateLimitEntry>();

function getWindowStart(now: number, windowSeconds: number): number {
  const windowMs = windowSeconds * 1000;
  return Math.floor(now / windowMs) * windowMs;
}

function buildStatus(
  key: string,
  limit: number,
  windowSeconds: number,
  count: number,
  windowStartMs: number,
): RateLimitStatusDto {
  const resetAt = new Date(windowStartMs + windowSeconds * 1000).toISOString();
  return {
    key,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    windowSeconds,
  };
}

export function getRateLimitStatus(
  key: string,
  limit: number,
  windowSeconds: number,
  now: Date = new Date(),
): RateLimitStatusDto {
  const nowMs = now.getTime();
  const windowStartMs = getWindowStart(nowMs, windowSeconds);
  const entry = entries.get(key);

  if (!entry || entry.windowStartMs !== windowStartMs) {
    return buildStatus(key, limit, windowSeconds, 0, windowStartMs);
  }

  return buildStatus(key, limit, windowSeconds, entry.count, entry.windowStartMs);
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  now: Date = new Date(),
): { allowed: boolean; status: RateLimitStatusDto } {
  const nowMs = now.getTime();
  const windowStartMs = getWindowStart(nowMs, windowSeconds);
  const existing = entries.get(key);

  let entry: RateLimitEntry;
  if (!existing || existing.windowStartMs !== windowStartMs) {
    entry = { count: 0, windowStartMs };
  } else {
    entry = existing;
  }

  if (entry.count >= limit) {
    entries.set(key, entry);
    return {
      allowed: false,
      status: buildStatus(key, limit, windowSeconds, entry.count, entry.windowStartMs),
    };
  }

  entry.count += 1;
  entries.set(key, entry);

  return {
    allowed: true,
    status: buildStatus(key, limit, windowSeconds, entry.count, entry.windowStartMs),
  };
}

export function cleanupExpiredRateLimitEntries(now: Date = new Date()): number {
  const nowMs = now.getTime();
  let removed = 0;

  for (const [key, entry] of entries.entries()) {
    if (nowMs - entry.windowStartMs > 60 * 60 * 1000) {
      entries.delete(key);
      removed += 1;
    }
  }

  return removed;
}
