import type { Express, Request, Response } from "express";
import { z } from "zod";
import type {
  AiQueryPreviewResponseDto,
  AiRankingConfigDto,
  EmbeddingCoverageDto,
  EmbeddingJobListResponseDto,
  ProductDocument,
  UserDto,
} from "@retailer-search/shared-types";
import {
  getAiRankingConfig,
  resolvePreviewModeConfig,
  updateAiRankingConfig,
} from "../ai-search/ai-ranking-config-store.js";
import {
  getEmbeddingCoverageSummary,
  getEmbeddingJob,
  listEmbeddingJobs,
  triggerEmbeddingJob,
} from "../ai-search/embedding-job-service.js";
import { executeHybridRankingPipeline } from "../ai-search/hybrid-ranking-pipeline.js";
import { hydrateVectorIndex } from "../ai-search/vector-index.js";
import {
  getPermissionDeniedMessage,
  hasPermissionForUser,
} from "../rbac.js";

const updateConfigSchema = z.object({
  enabled: z.boolean().optional(),
  semanticRetrievalEnabled: z.boolean().optional(),
  personalizationEnabled: z.boolean().optional(),
  semanticZeroResultsFallbackEnabled: z.boolean().optional(),
  semanticFallbackMinHits: z.number().int().min(0).max(100).optional(),
  embeddingsProvider: z.enum(["mock", "openai", "openrouter"]).optional(),
  embeddingsModel: z.string().min(1).optional(),
  embeddingDimensions: z.number().int().min(8).max(4096).optional(),
  weights: z
    .object({
      lexicalWeight: z.number().min(0).max(1).optional(),
      semanticWeight: z.number().min(0).max(1).optional(),
      personalizationWeight: z.number().min(0).max(1).optional(),
    })
    .optional(),
  personalizationLookbackDays: z.number().int().min(1).max(365).optional(),
  personalizationDecayHalfLifeDays: z.number().int().min(1).max(180).optional(),
  embeddingBatchSize: z.number().int().min(1).max(256).optional(),
  productEmbeddingsEnabled: z.boolean().optional(),
});

const triggerJobSchema = z.object({
  jobType: z.enum(["backfill", "incremental", "reindex"]).optional(),
  productIds: z.array(z.string()).optional(),
});

const previewSchema = z.object({
  query: z.string().min(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
  environment: z.enum(["staging", "live"]).default("staging"),
  previewMode: z
    .enum(["lexical", "hybrid", "hybrid_personalization", "semantic_rescue"])
    .default("hybrid"),
  sessionId: z.string().optional(),
});

export interface AiSearchRouteDeps {
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
  getProducts: () => Promise<ProductDocument[]>;
  getRules: (environment: "staging" | "live") => import("@retailer-search/shared-types").MerchandisingRule[];
}

export function registerAiSearchRoutes(app: Express, deps: AiSearchRouteDeps): void {
  app.get("/api/v1/admin/ai-search/config", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    const body: AiRankingConfigDto = await getAiRankingConfig();
    res.json(body);
  });

  app.patch("/api/v1/admin/ai-search/config", async (req, res) => {
    const user = deps.requireAdminUser(req, res);
    if (!user) {
      return;
    }
    if (!deps.requireJsonContentType(req, res)) {
      return;
    }
    const parsed = updateConfigSchema.safeParse(req.body);
    if (!deps.assertValidBody(parsed, res, req, "Invalid AI search config")) {
      return;
    }
    const body = await updateAiRankingConfig(parsed.data, {
      userId: user.id,
      email: user.email,
    });
    res.json(body);
  });

  app.get("/api/v1/admin/ai-search/embedding-jobs", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    const jobs = await listEmbeddingJobs();
    const body: EmbeddingJobListResponseDto = { total: jobs.length, jobs };
    res.json(body);
  });

  app.get("/api/v1/admin/ai-search/embedding-jobs/:id", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    const job = await getEmbeddingJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Embedding job not found" });
      return;
    }
    res.json(job);
  });

  app.post("/api/v1/admin/ai-search/embedding-jobs", async (req, res) => {
    const user = deps.requireAdminUser(req, res);
    if (!user) {
      return;
    }
    if (!deps.requireJsonContentType(req, res)) {
      return;
    }
    const parsed = triggerJobSchema.safeParse(req.body ?? {});
    if (!deps.assertValidBody(parsed, res, req, "Invalid embedding job payload")) {
      return;
    }
    const products = await deps.getProducts();
    const job = await triggerEmbeddingJob(products, parsed.data);
    res.status(202).json(job);
  });

  app.get("/api/v1/admin/ai-search/embedding-coverage", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    await hydrateVectorIndex();
    const products = await deps.getProducts();
    const body: EmbeddingCoverageDto = await getEmbeddingCoverageSummary(
      products.length,
    );
    res.json(body);
  });

  app.get("/api/v1/admin/ai-search/query-preview", async (req, res) => {
    const user = deps.requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    const effectiveRole = deps.getEffectiveRoleForUser(user);
    if (!hasPermissionForUser(user, "view_dashboard", effectiveRole)) {
      res.status(403).json({
        error: "forbidden",
        message: getPermissionDeniedMessage("view_dashboard"),
      });
      return;
    }

    const parsed = previewSchema.safeParse(req.query);
    if (!deps.assertValidBody(parsed, res, req, "Invalid preview query")) {
      return;
    }

    const products = await deps.getProducts();
    const baseConfig = await getAiRankingConfig();
    const previewConfig = resolvePreviewModeConfig(baseConfig, parsed.data.previewMode);
    const result = await executeHybridRankingPipeline(
      products,
      {
        query: parsed.data.query,
        page: 1,
        pageSize: parsed.data.pageSize,
      },
      {
        rules: deps.getRules(parsed.data.environment),
        debug: true,
        config: previewConfig,
        sessionId: parsed.data.sessionId,
        previewMode: parsed.data.previewMode,
      },
    );

    const body: AiQueryPreviewResponseDto = {
      query: parsed.data.query,
      previewMode: parsed.data.previewMode,
      total: result.totalHits,
      appliedRuleNames: result.appliedRuleNames ?? [],
      aiRankingDebug: result.aiRankingDebug,
      hits: result.hits.map((hit) => ({
        id: hit.id,
        title: hit.title,
        brand: hit.brand,
        category: hit.category,
        score: hit.score,
        inStock: hit.inStock,
        rankingDebug: hit.rankingDebug,
      })),
    };
    res.json(body);
  });
}
