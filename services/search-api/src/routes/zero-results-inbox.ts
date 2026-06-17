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
  updateRuleDraft,
  updateRuleDraftSchema,
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

    try {
      const draft = await generateRuleDraft(parsed.data, user.id);
      res.status(201).json(draft);
    } catch (error) {
      console.error("[rule-draft] generate failed", error);
      res.status(500).json({
        error: "rule_draft_generate_failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate rule draft. Check search-api logs and database connectivity.",
      });
    }
  });

  app.patch("/api/v1/admin/rule-drafts/:id", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    if (!deps.requireJsonContentType(req, res)) {
      return;
    }

    const parsed = updateRuleDraftSchema.safeParse(req.body);
    if (!deps.assertValidBody(parsed, res, req, "Invalid rule draft update payload")) {
      return;
    }

    const result = await updateRuleDraft(req.params.id, parsed.data);
    if (!result.ok) {
      if (result.reason === "not_found") {
        res.status(404).json({ error: "Rule draft not found" });
        return;
      }
      if (result.reason === "not_editable") {
        res.status(400).json({ error: result.message ?? "Draft cannot be edited" });
        return;
      }
      res.status(400).json({
        error: "Invalid rule draft",
        message: result.message ?? "Draft rule payload is invalid",
      });
      return;
    }

    res.json(result.draft);
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
