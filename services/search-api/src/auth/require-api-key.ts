import type { NextFunction, Request, Response } from "express";
import { checkRateLimit } from "../rate-limit-store.js";
import { recordRateLimitExceeded } from "../audit-trail-store.js";
import { recordApiUsage } from "../usage-meter-store.js";
import {
  attachRateLimitHeaders,
  getRequestId,
} from "../api-security.js";
import { rateLimited as rateLimitedError } from "../error-response.js";
import {
  hasScope,
  isApiKeyRequired,
  validateApiKey,
  type ValidatedApiKey,
} from "./api-key-store.js";

const DEFAULT_API_KEY_LIMIT = Number(process.env.DEFAULT_API_KEY_RATE_LIMIT ?? 120);

declare global {
  namespace Express {
    interface Request {
      apiKey?: ValidatedApiKey;
    }
  }
}

function readApiKeyHeader(req: Request): string | undefined {
  const header = req.header("x-api-key") ?? req.header("X-API-Key");
  if (header?.trim()) {
    return header.trim();
  }

  const auth = req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  return undefined;
}

export async function attachApiKeyContext(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const secret = readApiKeyHeader(req);
  if (secret) {
    req.apiKey = (await validateApiKey(secret)) ?? undefined;
  }
  next();
}

export function requireApiKeyScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isApiKeyRequired()) {
      next();
      return;
    }

    if (!req.apiKey) {
      res.status(401).json({
        error: "API key required",
        code: "API_KEY_REQUIRED",
      });
      return;
    }

    if (!hasScope(req.apiKey, scope)) {
      res.status(403).json({
        error: `Missing scope: ${scope}`,
        code: "API_KEY_SCOPE_DENIED",
      });
      return;
    }

    next();
  };
}

export function enforceApiKeyRateLimit(route: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      next();
      return;
    }

    const limit = req.apiKey.rateLimitPerMinute ?? DEFAULT_API_KEY_LIMIT;
    const result = checkRateLimit(
      `api-key:${req.apiKey.id}:${route}`,
      limit,
      60,
    );
    attachRateLimitHeaders(res, result.status);

    if (!result.allowed) {
      recordRateLimitExceeded({
        summary: `API key rate limit exceeded for route ${route}`,
        path: req.path,
        method: req.method,
        policyName: "api_key",
        metadata: {
          apiKeyId: req.apiKey.id,
          route,
        },
      });
      res
        .status(429)
        .json(
          rateLimitedError(
            "API key rate limit exceeded",
            undefined,
            getRequestId(req),
          ),
        );
      return;
    }

    void recordApiUsage({
      apiKeyId: req.apiKey.id,
      tenantId: req.apiKey.tenantId,
      route,
    });
    next();
  };
}
