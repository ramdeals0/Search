import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import type { z } from "zod";
import type { RateLimitStatusDto } from "@retailer-search/shared-types";
import { getRateLimitUserKeyFromAuthHeader } from "./auth-store.js";
import { checkRateLimit } from "./rate-limit-store.js";
import { validationError } from "./error-response.js";

export interface RateLimitPolicy {
  name: string;
  limit: number;
  windowSeconds: number;
  buildKey: (req: Request) => string;
}

export interface RateLimitConfig {
  authLogin: { limit: number; windowSeconds: number };
  adminMutation: { limit: number; windowSeconds: number };
  adminRead: { limit: number; windowSeconds: number };
}

export function getRateLimitConfig(): RateLimitConfig {
  return {
    authLogin: {
      limit: Number(process.env.RATE_LIMIT_AUTH_LOGIN_LIMIT ?? 5),
      windowSeconds: Number(process.env.RATE_LIMIT_AUTH_LOGIN_WINDOW_SECONDS ?? 300),
    },
    adminMutation: {
      limit: Number(process.env.RATE_LIMIT_ADMIN_MUTATION_LIMIT ?? 60),
      windowSeconds: Number(process.env.RATE_LIMIT_ADMIN_MUTATION_WINDOW_SECONDS ?? 60),
    },
    adminRead: {
      limit: Number(process.env.RATE_LIMIT_ADMIN_READ_LIMIT ?? 300),
      windowSeconds: Number(process.env.RATE_LIMIT_ADMIN_READ_WINDOW_SECONDS ?? 60),
    },
  };
}

export function getRequestId(req: Request): string {
  const headerValue = req.header("x-request-id")?.trim();
  if (headerValue) {
    return headerValue;
  }

  const existing = (req as Request & { requestId?: string }).requestId;
  if (existing) {
    return existing;
  }

  const requestId = randomUUID();
  (req as Request & { requestId?: string }).requestId = requestId;
  return requestId;
}

export function getClientIdentifier(req: Request): string {
  const forwarded = req.header("x-forwarded-for");
  if (forwarded) {
    const firstHop = forwarded.split(",")[0]?.trim();
    if (firstHop) {
      return firstHop;
    }
  }

  return req.ip ?? req.socket.remoteAddress ?? "unknown-client";
}

export function buildAdminRateLimitKey(req: Request, group: "read" | "mutation"): string {
  const subject =
    getRateLimitUserKeyFromAuthHeader(req.header("authorization")) ??
    `client:${getClientIdentifier(req)}`;
  return `admin:${group}:${subject}`;
}

export function buildAuthLoginRateLimitKey(req: Request, email?: string): string {
  const normalizedEmail = email?.trim().toLowerCase() ?? "unknown-email";
  return `auth:login:${getClientIdentifier(req)}:${normalizedEmail}`;
}

export function isAdminMutationRequest(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return false;
  }

  return req.path.startsWith("/api/v1/admin");
}

export function isSensitiveResponsePath(path: string): boolean {
  return (
    path.startsWith("/api/v1/auth") ||
    path.startsWith("/api/v1/admin") ||
    path.startsWith("/health")
  );
}

export function requireHttpsInProduction(req: Request, res: Response): boolean {
  const enforceHttps = process.env.ENFORCE_HTTPS === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (!enforceHttps || !isProduction) {
    return true;
  }

  const forwardedProto = req.header("x-forwarded-proto");
  if (req.secure || forwardedProto === "https") {
    return true;
  }

  res.status(403).json({
    success: false,
    code: "forbidden",
    message: "HTTPS is required",
    requestId: getRequestId(req),
  });
  return false;
}

export function attachSecurityHeaders(req: Request, res: Response): void {
  res.setHeader("x-request-id", getRequestId(req));
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "no-referrer");

  if (isSensitiveResponsePath(req.path)) {
    res.setHeader("cache-control", "no-store");
  }
}

export function attachRateLimitHeaders(
  res: Response,
  status: RateLimitStatusDto,
): void {
  res.setHeader("x-ratelimit-limit", String(status.limit));
  res.setHeader("x-ratelimit-remaining", String(status.remaining));
  res.setHeader("x-ratelimit-reset", status.resetAt);
}

export function applyRateLimit(
  req: Request,
  policy: RateLimitPolicy,
): { allowed: boolean; status: RateLimitStatusDto } {
  const key = policy.buildKey(req);
  return checkRateLimit(key, policy.limit, policy.windowSeconds);
}

export function requireJsonContentType(req: Request, res: Response): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  const contentType = req.header("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return true;
  }

  res.status(400).json(
    validationError("Content-Type must be application/json", undefined, getRequestId(req)),
  );
  return false;
}

export function parseAndValidateBody<T>(
  schema: z.ZodType<T>,
  req: Request,
): { success: true; data: T } | { success: false; error: ReturnType<z.ZodError["flatten"]> } {
  const parsed = schema.safeParse(req.body);
  if (parsed.success) {
    return parsed;
  }

  return {
    success: false,
    error: parsed.error.flatten(),
  };
}

export function createAdminReadRateLimitPolicy(
  config: RateLimitConfig = getRateLimitConfig(),
): RateLimitPolicy {
  return {
    name: "admin_read",
    limit: config.adminRead.limit,
    windowSeconds: config.adminRead.windowSeconds,
    buildKey: (req) => buildAdminRateLimitKey(req, "read"),
  };
}

export function createAdminMutationRateLimitPolicy(
  config: RateLimitConfig = getRateLimitConfig(),
): RateLimitPolicy {
  return {
    name: "admin_mutation",
    limit: config.adminMutation.limit,
    windowSeconds: config.adminMutation.windowSeconds,
    buildKey: (req) => buildAdminRateLimitKey(req, "mutation"),
  };
}

export function createAuthLoginRateLimitPolicy(
  email: string,
  config: RateLimitConfig = getRateLimitConfig(),
): RateLimitPolicy {
  return {
    name: "auth_login",
    limit: config.authLogin.limit,
    windowSeconds: config.authLogin.windowSeconds,
    buildKey: (req) => buildAuthLoginRateLimitKey(req, email),
  };
}