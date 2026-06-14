import type { NextFunction, Request, Response } from "express";
import type { UserDto } from "@retailer-search/shared-types";
import { getCurrentUserFromAuthHeader } from "../auth-store.js";
import { sanitizeResponseForViewer } from "./sanitize-response.js";

function shouldSanitizeResponsePath(path: string): boolean {
  return path.startsWith("/api/v1/admin") || path === "/api/v1/setup/status";
}

export function attachPiiSanitizationMiddleware(
  getUser: (authorizationHeader: string | undefined) => UserDto | null = getCurrentUserFromAuthHeader,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!shouldSanitizeResponsePath(req.path)) {
      next();
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const user = getUser(req.headers.authorization);
      const sanitized = sanitizeResponseForViewer(body, {
        standingRole: user?.role,
        viewerEmail: user?.email,
      });
      return originalJson(sanitized);
    };

    next();
  };
}
