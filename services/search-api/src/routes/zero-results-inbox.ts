import type { Express, Request, Response } from "express";
import { z } from "zod";
import type {
  RuleDraftListResponseDto,
  UserDto,
  ZeroResultInsightsResponseDto,
} from "@retailer-search/shared-types";
import { getZeroResultInsights } from "../analytics-store.js";
import {
  approveRuleDraft,
  generateRuleDraft,
  getRuleDraftById,
  listRuleDrafts,
  markRuleDraftApplied,
  rejectRuleDraft,
} from "../llm/rule-draft-service.js";
import { createMerchandisingRule } from "../merchandising-rules.js";

const generateRuleDraftSchema = z.object({
  query: z.string().min(1),
  productId: z.string().optional(),
});

export interface ZeroResultsInboxRouteDeps {
  requireAuthenticatedUser: (req: Request, res: Response) => UserDto | null;
  requireJsonContentType: (req: Request, res: Response) => boolean;
  assertValidBody: <T>(
    parsed: z.SafeParseReturnType<unknown, T>,
    res: Response,
    req: Request,
    message?: string,
  ) => parsed is z.SafeParseSuccess<T>;
}

export function registerZeroResultsInboxRoutes(
  app: Express,
  deps: ZeroResultsInboxRouteDeps,
): void {
  app.get("/api/v1/admin/analytics/zero-results", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const limit = z.coerce.number().int().positive().max(100).default(25).parse(
      req.query.limit ?? 25,
    );
    const body: ZeroResultInsightsResponseDto = await getZeroResultInsights(limit);
    res.json(body);
  });

  app.get("/api/v1/admin/rule-drafts", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const drafts = await listRuleDrafts();
    const body: RuleDraftListResponseDto = {
      total: drafts.length,
      drafts,
    };
    res.json(body);
  });

  app.post("/api/v1/admin/rule-drafts/generate", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    if (!deps.requireJsonContentType(req, res)) {
      return;
    }

    const parsed = generateRuleDraftSchema.safeParse(req.body);
    if (!deps.assertValidBody(parsed, res, req, "Invalid rule draft payload")) {
      return;
    }

    const draft = await generateRuleDraft(parsed.data, user.id);
    res.status(201).json(draft);
  });

  app.post("/api/v1/admin/rule-drafts/:id/approve", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const draft = await approveRuleDraft(req.params.id);
    if (!draft) {
      res.status(404).json({ error: "Rule draft not found" });
      return;
    }

    res.json(draft);
  });

  app.post("/api/v1/admin/rule-drafts/:id/reject", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const draft = await rejectRuleDraft(req.params.id);
    if (!draft) {
      res.status(404).json({ error: "Rule draft not found" });
      return;
    }

    res.json(draft);
  });

  app.post("/api/v1/admin/rule-drafts/:id/apply", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const draft = await getRuleDraftById(req.params.id);
    if (!draft || draft.status !== "approved") {
      res.status(400).json({ error: "Approved rule draft required before apply" });
      return;
    }

    const ruleInput = draft.suggestedRule as {
      name?: string;
      action?: "pin" | "boost" | "bury" | "hide";
      condition?: Record<string, unknown>;
      productIds?: string[];
      boostAmount?: number;
      buryAmount?: number;
    };

    if (!ruleInput.name || !ruleInput.action) {
      res.status(400).json({ error: "Draft is missing required rule fields" });
      return;
    }

    createMerchandisingRule(
      {
        name: ruleInput.name,
        active: true,
        priority: 100,
        action: ruleInput.action,
        condition: ruleInput.condition ?? { query: draft.query },
        productIds: ruleInput.productIds,
        boostAmount: ruleInput.boostAmount,
        buryAmount: ruleInput.buryAmount,
      },
      "staging",
    );

    const applied = await markRuleDraftApplied(draft.id);
    res.json(applied);
  });
}
