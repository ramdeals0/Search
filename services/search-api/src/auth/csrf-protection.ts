import type { NextFunction, Request, Response } from "express";
import { getCurrentUserFromAuthHeader } from "../auth-store.js";
import { forbidden } from "../error-response.js";
import { getRequestId } from "../api-security.js";
import {
  CSRF_HEADER_NAME,
  getSessionTokenFromAuthHeader,
  validateCsrfToken,
} from "./csrf-token.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const EXEMPT_PATH_PREFIXES = [
  "/health",
  "/metrics",
  "/api/v1/auth/login",
  "/api/v1/setup/",
  "/api/v1/internal/",
] as const;

function isExemptPath(path: string): boolean {
  return EXEMPT_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix),
  );
}

export function enforceCsrfProtection(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (SAFE_METHODS.has(req.method) || isExemptPath(req.path)) {
    next();
    return;
  }

  if (req.apiKey) {
    next();
    return;
  }

  const authHeader = req.header("authorization");
  const sessionToken = getSessionTokenFromAuthHeader(authHeader);
  if (!sessionToken || !getCurrentUserFromAuthHeader(authHeader)) {
    next();
    return;
  }

  const csrfHeader = req.header(CSRF_HEADER_NAME)?.trim();
  if (!csrfHeader || !validateCsrfToken(sessionToken, csrfHeader)) {
    res
      .status(403)
      .json(
        forbidden(
          "Invalid or missing CSRF token",
          getRequestId(req),
        ),
      );
    return;
  }

  next();
}
