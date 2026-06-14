import type { Express, Request, Response } from "express";
import { z } from "zod";
import type {
  LlmSettingsDto,
  UpdateLlmSettingsRequestDto,
  UserDto,
} from "@retailer-search/shared-types";
import { getLlmSettings, updateLlmSettings } from "../llm/llm-config-store.js";

const updateLlmSettingsSchema = z.object({
  provider: z.enum(["openrouter", "groq", "none"]).optional(),
  model: z.string().min(1).max(200).optional(),
  timeoutMs: z.coerce.number().int().min(500).max(60_000).optional(),
  cacheTtlMs: z.coerce.number().int().min(0).max(3_600_000).optional(),
  maxQueryChars: z.coerce.number().int().min(32).max(500).optional(),
  rerankTopK: z.coerce.number().int().min(1).max(50).optional(),
  debugLogging: z.boolean().optional(),
  queryRewriteEnabled: z.boolean().optional(),
  zeroResultsEnabled: z.boolean().optional(),
  rerankEnabled: z.boolean().optional(),
});

export interface LlmSettingsRouteDeps {
  requireAdminUser: (req: Request, res: Response) => UserDto | null;
  assertValidBody: <T>(
    parsed: z.SafeParseReturnType<unknown, T>,
    res: Response,
    req: Request,
    message?: string,
  ) => parsed is z.SafeParseSuccess<T>;
}

export function registerLlmSettingsRoutes(
  app: Express,
  deps: LlmSettingsRouteDeps,
): void {
  app.get("/api/v1/admin/llm-settings", (req, res) => {
    const admin = deps.requireAdminUser(req, res);
    if (!admin) {
      return;
    }

    const body: LlmSettingsDto = getLlmSettings();
    res.json(body);
  });

  app.post("/api/v1/admin/llm-settings", async (req, res) => {
    const admin = deps.requireAdminUser(req, res);
    if (!admin) {
      return;
    }

    const parsed = updateLlmSettingsSchema.safeParse(req.body);
    if (!deps.assertValidBody(parsed, res, req, "Invalid LLM settings payload")) {
      return;
    }

    const body: LlmSettingsDto = await updateLlmSettings(
      parsed.data as UpdateLlmSettingsRequestDto,
      admin,
    );
    res.json(body);
  });
}
