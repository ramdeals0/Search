import type { Express, Request, Response } from "express";
import { z } from "zod";
import type {
  OnlineExperimentStatusDto,
  RecordCommerceEventRequestDto,
  SearchContentModuleDto,
  UserDto,
} from "@retailer-search/shared-types";
import { getRecentQueriesForSession, getTrendingQueries } from "../discovery-store.js";
import {
  createContentModule,
  listContentModules,
} from "../content-modules-store.js";
import {
  importProductsFromCsv,
  listAdminProducts,
  updateAdminProduct,
} from "../catalog-admin-store.js";
import { inspectRuleConflicts } from "../rule-conflict-service.js";
import { getRevenueMetrics, recordCommerceEvent } from "../commerce-event-store.js";
import { recordCommerceAffinity } from "../personalization-store.js";
import { getExperimentById, setExperimentOnlineStatus } from "../experiment-store.js";
import { requireApiKeyScope } from "../auth/require-api-key.js";

const environmentKeySchema = z.enum(["staging", "live"]);

const trendingQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(10),
  days: z.coerce.number().int().positive().max(90).default(7),
});

const recentQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(10),
});

const createContentModuleSchema = z.object({
  name: z.string().min(1),
  active: z.boolean().default(true),
  environment: environmentKeySchema.default("staging"),
  moduleType: z.enum(["banner", "category_rail", "message"]),
  priority: z.number().int().default(100),
  condition: z
    .object({
      query: z.string().optional(),
      brand: z.string().optional(),
      category: z.string().optional(),
    })
    .default({}),
  content: z
    .object({
      title: z.string().optional(),
      body: z.string().optional(),
      href: z.string().optional(),
      category: z.string().optional(),
    })
    .default({}),
});

const updateProductSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.number().optional(),
  inventory: z.number().int().min(0).optional(),
  inStock: z.boolean().optional(),
});

const importCsvSchema = z.object({
  csvText: z.string().min(1),
});

const conflictQuerySchema = z.object({
  query: z.string().min(1),
  environment: environmentKeySchema.default("staging"),
});

const revenueQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).default(30),
});

const commerceEventSchema = z.object({
  type: z.enum(["add_to_cart", "purchase"]),
  query: z.string().optional(),
  productId: z.string().optional(),
  amountCents: z.number().int().nonnegative().optional(),
});

const onlineToggleSchema = z.object({
  onlineEnabled: z.boolean(),
  onlineTrafficPercent: z.number().int().min(0).max(100).optional(),
});

export interface PlatformEnhancementRouteDeps {
  requireAuthenticatedUser: (req: Request, res: Response) => UserDto | null;
  requireJsonContentType: (req: Request, res: Response) => boolean;
  assertValidBody: <T>(
    parsed: z.SafeParseReturnType<unknown, T>,
    res: Response,
    req: Request,
    message?: string,
  ) => parsed is z.SafeParseSuccess<T>;
  getAnalyticsContext: (req: Request) => {
    tenantId?: string;
    sessionId?: string;
  };
}

export function registerPlatformEnhancementRoutes(
  app: Express,
  deps: PlatformEnhancementRouteDeps,
): void {
  app.get("/api/v1/discovery/trending", async (req, res) => {
    const parsed = trendingQuerySchema.safeParse(req.query);
    if (!deps.assertValidBody(parsed, res, req, "Invalid discovery query")) {
      return;
    }

    const queries = await getTrendingQueries(parsed.data.limit, parsed.data.days);
    res.json({
      generatedAt: new Date().toISOString(),
      windowDays: parsed.data.days,
      queries,
    });
  });

  app.get("/api/v1/discovery/recent", async (req, res) => {
    const parsed = recentQuerySchema.safeParse(req.query);
    if (!deps.assertValidBody(parsed, res, req, "Invalid discovery query")) {
      return;
    }

    const sessionId = req.header("x-session-id")?.trim();
    if (!sessionId) {
      res.status(400).json({ error: "x-session-id header is required" });
      return;
    }

    const queries = await getRecentQueriesForSession(sessionId, parsed.data.limit);
    res.json({
      sessionId,
      queries,
    });
  });

  app.get("/api/v1/admin/content-modules", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    const environment = environmentKeySchema.safeParse(req.query.environment);
    const modules = await listContentModules(
      environment.success ? environment.data : undefined,
    );
    res.json({
      total: modules.length,
      modules,
    });
  });

  app.post("/api/v1/admin/content-modules", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    if (!deps.requireJsonContentType(req, res)) {
      return;
    }
    const parsed = createContentModuleSchema.safeParse(req.body);
    if (!deps.assertValidBody(parsed, res, req, "Invalid content module payload")) {
      return;
    }
    const created = await createContentModule(parsed.data as Omit<SearchContentModuleDto, "id">);
    res.status(201).json(created);
  });

  app.get("/api/v1/admin/products", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    const limit = z.coerce.number().int().positive().max(500).default(100).parse(
      req.query.limit ?? 100,
    );
    res.json(await listAdminProducts(limit));
  });

  app.patch("/api/v1/admin/products/:id", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    if (!deps.requireJsonContentType(req, res)) {
      return;
    }
    const parsed = updateProductSchema.safeParse(req.body);
    if (!deps.assertValidBody(parsed, res, req, "Invalid product patch payload")) {
      return;
    }
    const updated = await updateAdminProduct(req.params.id, parsed.data);
    if (!updated) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(updated);
  });

  app.post("/api/v1/admin/products/import-csv", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    if (!deps.requireJsonContentType(req, res)) {
      return;
    }
    const parsed = importCsvSchema.safeParse(req.body);
    if (!deps.assertValidBody(parsed, res, req, "Invalid CSV import payload")) {
      return;
    }
    const result = await importProductsFromCsv(parsed.data.csvText);
    res.status(201).json(result);
  });

  app.get("/api/v1/admin/merchandising/conflicts", (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    const parsed = conflictQuerySchema.safeParse(req.query);
    if (!deps.assertValidBody(parsed, res, req, "Invalid conflict query")) {
      return;
    }
    res.json(inspectRuleConflicts(parsed.data.query, parsed.data.environment));
  });

  app.post("/api/v1/events/commerce", requireApiKeyScope("events:write"), async (req, res) => {
    if (!deps.requireJsonContentType(req, res)) {
      return;
    }
    const parsed = commerceEventSchema.safeParse(req.body);
    if (!deps.assertValidBody(parsed, res, req, "Invalid commerce event payload")) {
      return;
    }
    const analyticsContext = deps.getAnalyticsContext(req);
    await recordCommerceEvent(parsed.data as RecordCommerceEventRequestDto, {
      tenantId: analyticsContext.tenantId,
      sessionId: analyticsContext.sessionId,
      metadata: { source: "api" },
    });
    if (analyticsContext.sessionId && parsed.data.productId) {
      await recordCommerceAffinity(
        analyticsContext.sessionId,
        parsed.data.type,
        parsed.data.productId,
        parsed.data.query,
      );
    }
    res.status(201).json({ success: true });
  });

  app.get("/api/v1/admin/analytics/revenue", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    const parsed = revenueQuerySchema.safeParse(req.query);
    if (!deps.assertValidBody(parsed, res, req, "Invalid revenue query")) {
      return;
    }
    res.json(await getRevenueMetrics(parsed.data.days));
  });

  app.post("/api/v1/admin/experiments/:id/online", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    if (!deps.requireJsonContentType(req, res)) {
      return;
    }
    const parsed = onlineToggleSchema.safeParse(req.body);
    if (!deps.assertValidBody(parsed, res, req, "Invalid online experiment payload")) {
      return;
    }
    const existing = await getExperimentById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Experiment not found" });
      return;
    }

    const updated = await setExperimentOnlineStatus(
      req.params.id,
      parsed.data.onlineEnabled,
      parsed.data.onlineTrafficPercent,
    );
    if (!updated) {
      res.status(404).json({ error: "Experiment not found" });
      return;
    }

    const body: OnlineExperimentStatusDto = {
      experimentId: updated.id,
      name: updated.name,
      onlineEnabled: updated.onlineEnabled ?? false,
      assignedArm: null,
      trafficPercent: updated.onlineTrafficPercent ?? 50,
    };
    res.json(body);
  });
}
