import type { Express, Request, Response } from "express";
import type { MerchandisingRule, ProductDocument } from "@retailer-search/shared-types";
import { z } from "zod";
import { getLlmMetricsSnapshot } from "../llm/metrics/llm-metrics.js";
import { getUnderstandingCacheSize } from "../llm/query-understanding-service.js";
import { debugQueryUnderstanding, llmEnhancedSearch } from "../search/llm-enhanced-search.js";
import { getSearchFeatureFlags } from "../search/search-feature-flags.js";

const querySchema = z.object({
  query: z.string().min(1),
  debug: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
});

const previewSchema = z.object({
  query: z.string().min(1),
  pageSize: z.coerce.number().int().positive().max(20).default(10),
});

export function registerInternalLlmDebugRoutes(
  app: Express,
  deps: {
    getProducts: () => Promise<ProductDocument[]>;
    getRules: () => MerchandisingRule[];
  },
): void {
  app.get("/api/v1/internal/llm/metrics", (_req: Request, res: Response) => {
    res.json({
      flags: getSearchFeatureFlags(),
      metrics: getLlmMetricsSnapshot(),
      understandingCacheSize: getUnderstandingCacheSize(),
    });
  });

  app.get("/api/v1/internal/llm/query-understanding", async (req: Request, res: Response) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
      return;
    }

    const result = await debugQueryUnderstanding(parsed.data.query);
    res.json({
      query: parsed.data.query,
      flags: getSearchFeatureFlags(),
      result,
    });
  });

  app.get("/api/v1/internal/llm/search-preview", async (req: Request, res: Response) => {
    const parsed = previewSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
      return;
    }

    const products = await deps.getProducts();
    const response = await llmEnhancedSearch(
      products,
      {
        query: parsed.data.query,
        page: 1,
        pageSize: parsed.data.pageSize,
      },
      {
        rules: deps.getRules(),
        debug: true,
      },
    );

    res.json(response);
  });
}
