import type { Express, Request, Response } from "express";
import { z } from "zod";
import type {
  ApiUsageSummaryDto,
  CatalogListResponseDto,
  DeveloperApiKeyListResponseDto,
  PluginListResponseDto,
  UserDto,
} from "@retailer-search/shared-types";
import {
  createCatalog,
  getCatalogById,
  listCatalogs,
  updateCatalog,
} from "../catalog-registry-store.js";
import {
  getAdminBranding,
  updateAdminBranding,
} from "../branding-store.js";
import {
  createDeveloperApiKey,
  listApiKeys,
  listApiKeysForOwner,
  revokeApiKey,
  revokeOwnedApiKey,
  rotateApiKey,
} from "../auth/api-key-store.js";
import {
  getApiUsageSummary,
  getApiUsageSummaryForKeys,
} from "../usage-meter-store.js";
import {
  listPluginDescriptors,
  setPluginEnabled,
} from "../plugin-registry.js";
import {
  getPermissionDeniedMessage,
  hasPermissionForUser,
} from "../rbac.js";

const createCatalogSchema = z.object({
  tenantId: z.string().optional(),
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
});

const updateCatalogSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  active: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

const brandingSchema = z.object({
  instanceName: z.string().min(1).max(120).optional(),
  logoUrl: z.string().url().or(z.literal("")).optional(),
  primaryColor: z.string().min(4).max(32).optional(),
  accentColor: z.string().min(4).max(32).optional(),
  sidebarColor: z.string().min(4).max(32).optional(),
});

const createDeveloperKeySchema = z.object({
  name: z.string().min(1).max(120),
  tenantId: z.string().optional(),
  rateLimitPerMinute: z.coerce.number().int().positive().max(10_000).optional(),
});

const pluginToggleSchema = z.object({
  enabled: z.boolean(),
});

const usageQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(90).default(7),
});

export interface PlatformP4RouteDeps {
  requireAuthenticatedUser: (req: Request, res: Response) => UserDto | null;
  requireAdminUser: (req: Request, res: Response) => UserDto | null;
  requireJsonContentType: (req: Request, res: Response) => boolean;
  assertValidBody: <T>(
    parsed: z.SafeParseReturnType<unknown, T>,
    res: Response,
    req: Request,
    message?: string,
  ) => parsed is z.SafeParseSuccess<T>;
  getEffectiveRoleForUser: (user: UserDto) => UserDto["role"];
}

function requirePermission(
  user: UserDto,
  permission: Parameters<typeof hasPermissionForUser>[1],
  effectiveRole: UserDto["role"],
  res: Response,
  req: Request,
): boolean {
  if (!hasPermissionForUser(user, permission, effectiveRole)) {
    res.status(403).json({
      error: "forbidden",
      message: getPermissionDeniedMessage(permission),
      requestId: req.header("x-request-id") ?? undefined,
    });
    return false;
  }
  return true;
}

export function registerPlatformP4Routes(
  app: Express,
  deps: PlatformP4RouteDeps,
): void {
  app.get("/api/v1/branding", async (_req, res) => {
    res.json(await getAdminBranding());
  });

  app.get("/api/v1/admin/branding", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    res.json(await getAdminBranding());
  });

  app.patch("/api/v1/admin/branding", async (req, res) => {
    const user = deps.requireAdminUser(req, res);
    if (!user) {
      return;
    }

    const effectiveRole = deps.getEffectiveRoleForUser(user);
    if (
      !requirePermission(user, "manage_branding", effectiveRole, res, req)
    ) {
      return;
    }

    if (!deps.requireJsonContentType(req, res)) {
      return;
    }

    const parsed = brandingSchema.safeParse(req.body);
    if (!deps.assertValidBody(parsed, res, req, "Invalid branding payload")) {
      return;
    }

    const branding = await updateAdminBranding(parsed.data);
    res.json(branding);
  });

  app.get("/api/v1/admin/catalogs", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const effectiveRole = deps.getEffectiveRoleForUser(user);
    if (
      !requirePermission(user, "manage_catalogs", effectiveRole, res, req)
    ) {
      return;
    }

    const tenantId =
      typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
    const catalogs = await listCatalogs(tenantId);
    const body: CatalogListResponseDto = {
      total: catalogs.length,
      catalogs,
    };
    res.json(body);
  });

  app.post("/api/v1/admin/catalogs", async (req, res) => {
    const user = deps.requireAdminUser(req, res);
    if (!user) {
      return;
    }

    const effectiveRole = deps.getEffectiveRoleForUser(user);
    if (
      !requirePermission(user, "manage_catalogs", effectiveRole, res, req)
    ) {
      return;
    }

    if (!deps.requireJsonContentType(req, res)) {
      return;
    }

    const parsed = createCatalogSchema.safeParse(req.body);
    if (!deps.assertValidBody(parsed, res, req, "Invalid catalog payload")) {
      return;
    }

    const catalog = await createCatalog(parsed.data);
    res.status(201).json(catalog);
  });

  app.patch("/api/v1/admin/catalogs/:id", async (req, res) => {
    const user = deps.requireAdminUser(req, res);
    if (!user) {
      return;
    }

    const effectiveRole = deps.getEffectiveRoleForUser(user);
    if (
      !requirePermission(user, "manage_catalogs", effectiveRole, res, req)
    ) {
      return;
    }

    if (!deps.requireJsonContentType(req, res)) {
      return;
    }

    const parsed = updateCatalogSchema.safeParse(req.body);
    if (!deps.assertValidBody(parsed, res, req, "Invalid catalog payload")) {
      return;
    }

    const catalog = await updateCatalog(req.params.id, parsed.data);
    if (!catalog) {
      res.status(404).json({ error: "Catalog not found" });
      return;
    }

    res.json(catalog);
  });

  app.get("/api/v1/admin/catalogs/:id", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const effectiveRole = deps.getEffectiveRoleForUser(user);
    if (
      !requirePermission(user, "manage_catalogs", effectiveRole, res, req)
    ) {
      return;
    }

    const catalog = await getCatalogById(req.params.id);
    if (!catalog) {
      res.status(404).json({ error: "Catalog not found" });
      return;
    }

    res.json(catalog);
  });

  app.get("/api/v1/admin/plugins", async (req, res) => {
    const user = deps.requireAdminUser(req, res);
    if (!user) {
      return;
    }

    const body: PluginListResponseDto = {
      total: listPluginDescriptors().length,
      plugins: listPluginDescriptors(),
    };
    res.json(body);
  });

  app.patch("/api/v1/admin/plugins/:id", async (req, res) => {
    const user = deps.requireAdminUser(req, res);
    if (!user) {
      return;
    }

    if (!deps.requireJsonContentType(req, res)) {
      return;
    }

    const parsed = pluginToggleSchema.safeParse(req.body);
    if (!deps.assertValidBody(parsed, res, req, "Invalid plugin payload")) {
      return;
    }

    const updated = setPluginEnabled(req.params.id, parsed.data.enabled);
    if (!updated) {
      res.status(404).json({ error: "Plugin not found" });
      return;
    }

    res.json({ plugin: listPluginDescriptors().find((p) => p.id === req.params.id) });
  });

  app.get("/api/v1/admin/api-usage", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const effectiveRole = deps.getEffectiveRoleForUser(user);
    if (
      !requirePermission(user, "view_api_usage", effectiveRole, res, req)
    ) {
      return;
    }

    const parsed = usageQuerySchema.safeParse(req.query);
    if (!deps.assertValidBody(parsed, res, req, "Invalid usage query")) {
      return;
    }

    const since = new Date(Date.now() - parsed.data.days * 24 * 60 * 60 * 1000);

    if (user.role === "developer") {
      const ownedKeys = await listApiKeysForOwner(user.id);
      const summary = await getApiUsageSummaryForKeys(
        ownedKeys.map((key) => key.id),
        since,
      );
      const body: ApiUsageSummaryDto = summary;
      res.json(body);
      return;
    }

    const body: ApiUsageSummaryDto = await getApiUsageSummary(since);
    res.json(body);
  });

  app.get("/api/v1/developer/api-keys", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const effectiveRole = deps.getEffectiveRoleForUser(user);
    if (
      !requirePermission(user, "manage_own_api_keys", effectiveRole, res, req)
    ) {
      return;
    }

    const apiKeys =
      user.role === "admin"
        ? await listApiKeys()
        : await listApiKeysForOwner(user.id);
    const body: DeveloperApiKeyListResponseDto = {
      total: apiKeys.length,
      apiKeys,
    };
    res.json(body);
  });

  app.post("/api/v1/developer/api-keys", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const effectiveRole = deps.getEffectiveRoleForUser(user);
    if (
      !requirePermission(user, "manage_own_api_keys", effectiveRole, res, req)
    ) {
      return;
    }

    if (!deps.requireJsonContentType(req, res)) {
      return;
    }

    const parsed = createDeveloperKeySchema.safeParse(req.body);
    if (!deps.assertValidBody(parsed, res, req, "Invalid API key payload")) {
      return;
    }

    const body = await createDeveloperApiKey(user.id, parsed.data);
    res.status(201).json(body);
  });

  app.delete("/api/v1/developer/api-keys/:id", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const effectiveRole = deps.getEffectiveRoleForUser(user);
    if (
      !requirePermission(user, "manage_own_api_keys", effectiveRole, res, req)
    ) {
      return;
    }

    const revoked =
      user.role === "admin"
        ? await revokeApiKey(req.params.id)
        : await revokeOwnedApiKey(req.params.id, user.id);
    if (!revoked) {
      res.status(404).json({ error: "API key not found" });
      return;
    }

    res.json({ apiKey: revoked });
  });

  app.post("/api/v1/developer/api-keys/:id/rotate", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const effectiveRole = deps.getEffectiveRoleForUser(user);
    if (
      !requirePermission(user, "manage_own_api_keys", effectiveRole, res, req)
    ) {
      return;
    }

    const rotated = await rotateApiKey(
      req.params.id,
      user.role === "admin" ? undefined : user.id,
    );
    if (!rotated) {
      res.status(404).json({ error: "API key not found" });
      return;
    }

    res.json(rotated);
  });
}
