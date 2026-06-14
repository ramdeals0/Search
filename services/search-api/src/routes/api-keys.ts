import type { Express, Request, Response } from "express";
import { z } from "zod";
import type {
  ApiKeyListResponseDto,
  UserDto,
} from "@retailer-search/shared-types";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "../auth/api-key-store.js";

const createApiKeySchema = z.object({
  name: z.string().min(1),
  tenantId: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  rateLimitPerMinute: z.coerce.number().int().positive().max(10_000).optional(),
  expiresAt: z.string().datetime().optional(),
});

export interface ApiKeyRouteDeps {
  requireAdminUser: (req: Request, res: Response) => UserDto | null;
  requireJsonContentType: (req: Request, res: Response) => boolean;
  assertValidBody: <T>(
    parsed: z.SafeParseReturnType<unknown, T>,
    res: Response,
    req: Request,
    message?: string,
  ) => parsed is z.SafeParseSuccess<T>;
}

export function registerApiKeyRoutes(app: Express, deps: ApiKeyRouteDeps): void {
  app.get("/api/v1/admin/api-keys", async (req, res) => {
    const admin = deps.requireAdminUser(req, res);
    if (!admin) {
      return;
    }

    const apiKeys = await listApiKeys();
    const body: ApiKeyListResponseDto = {
      total: apiKeys.length,
      apiKeys,
    };
    res.json(body);
  });

  app.post("/api/v1/admin/api-keys", async (req, res) => {
    const admin = deps.requireAdminUser(req, res);
    if (!admin) {
      return;
    }

    if (!deps.requireJsonContentType(req, res)) {
      return;
    }

    const parsed = createApiKeySchema.safeParse(req.body);
    if (!deps.assertValidBody(parsed, res, req, "Invalid API key payload")) {
      return;
    }

    const body = await createApiKey(parsed.data);
    res.status(201).json(body);
  });

  app.delete("/api/v1/admin/api-keys/:id", async (req, res) => {
    const admin = deps.requireAdminUser(req, res);
    if (!admin) {
      return;
    }

    const revoked = await revokeApiKey(req.params.id);
    if (!revoked) {
      res.status(404).json({ error: "API key not found" });
      return;
    }

    res.json({ apiKey: revoked });
  });
}
