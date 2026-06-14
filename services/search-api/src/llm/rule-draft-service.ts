import { z } from "zod";
import type { GenerateRuleDraftRequestDto, RuleDraftDto } from "@retailer-search/shared-types";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { createLlmProvider } from "./provider.js";
import { getSearchFeatureFlags } from "../search/search-feature-flags.js";
import { validateJsonPayload } from "./parsing/validate.js";

const ruleDraftSchema = z.object({
  name: z.string().min(1),
  action: z.enum(["pin", "boost", "bury", "hide"]),
  condition: z.object({
    query: z.string().optional(),
    brand: z.string().optional(),
    category: z.string().optional(),
    inStock: z.boolean().optional(),
  }),
  productIds: z.array(z.string()).optional(),
  boostAmount: z.number().optional(),
  buryAmount: z.number().optional(),
  rationale: z.string().optional(),
});

function buildRuleDraftPrompt(input: GenerateRuleDraftRequestDto): string {
  return [
    "You draft merchandising rules for a home-improvement retailer search platform.",
    "Return strict JSON only with keys:",
    "name, action, condition, productIds, boostAmount, buryAmount, rationale",
    "Rules:",
    "- action must be pin, boost, bury, or hide",
    "- condition.query should match the shopper query",
    "- prefer boost/pin for relevant products",
    "- keep rationale concise for operator review",
    "",
    `Zero-result or low-result query: ${input.query}`,
    input.productId ? `Suggested product id: ${input.productId}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function toDto(row: {
  id: string;
  query: string;
  status: string;
  suggestedRule: unknown;
  rationale: string | null;
  source: string;
  createdByUserId: string | null;
  approvalRequestId: string | null;
  createdAt: Date;
}): RuleDraftDto {
  return {
    id: row.id,
    query: row.query,
    status: row.status as RuleDraftDto["status"],
    suggestedRule: row.suggestedRule as Record<string, unknown>,
    rationale: row.rationale ?? undefined,
    source: row.source,
    createdByUserId: row.createdByUserId ?? undefined,
    approvalRequestId: row.approvalRequestId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function generateRuleDraft(
  input: GenerateRuleDraftRequestDto,
  actorUserId?: string,
): Promise<RuleDraftDto> {
  const config = getSearchFeatureFlags();
  const provider = createLlmProvider({
    provider: config.provider,
    model: config.model,
    timeoutMs: config.timeoutMs,
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    groqApiKey: process.env.GROQ_API_KEY,
  });

  let suggestedRule: Record<string, unknown> = {
    name: `Recover zero results for '${input.query.trim()}'`,
    action: "boost",
    condition: { query: input.query.trim().toLowerCase() },
    productIds: input.productId ? [input.productId] : [],
    boostAmount: 15,
    rationale: "Heuristic fallback draft when LLM is unavailable.",
  };
  let rationale = "Heuristic fallback draft when LLM is unavailable.";

  if (provider) {
    const completion = await provider.complete({
      messages: [
        {
          role: "user",
          content: buildRuleDraftPrompt(input),
        },
      ],
      temperature: 0.2,
      jsonMode: true,
      maxTokens: 500,
    });

    const validated = validateJsonPayload(completion.content, ruleDraftSchema);
    if (validated.ok) {
      suggestedRule = validated.data as Record<string, unknown>;
      rationale =
        typeof validated.data.rationale === "string"
          ? validated.data.rationale
          : "LLM-generated merchandising draft.";
    }
  }

  const row = await prisma.ruleDraft.create({
    data: {
      query: input.query.trim(),
      suggestedRule: suggestedRule as Prisma.InputJsonValue,
      rationale,
      source: provider ? "llm" : "heuristic",
      createdByUserId: actorUserId,
    },
  });

  return toDto(row);
}

export async function listRuleDrafts(): Promise<RuleDraftDto[]> {
  const rows = await prisma.ruleDraft.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map(toDto);
}

export async function approveRuleDraft(id: string): Promise<RuleDraftDto | null> {
  try {
    const row = await prisma.ruleDraft.update({
      where: { id },
      data: { status: "approved" },
    });
    return toDto(row);
  } catch {
    return null;
  }
}

export async function rejectRuleDraft(id: string): Promise<RuleDraftDto | null> {
  try {
    const row = await prisma.ruleDraft.update({
      where: { id },
      data: { status: "rejected" },
    });
    return toDto(row);
  } catch {
    return null;
  }
}

export async function markRuleDraftApplied(id: string): Promise<RuleDraftDto | null> {
  try {
    const row = await prisma.ruleDraft.update({
      where: { id },
      data: { status: "applied" },
    });
    return toDto(row);
  } catch {
    return null;
  }
}

export async function getRuleDraftById(id: string): Promise<RuleDraftDto | null> {
  const row = await prisma.ruleDraft.findUnique({ where: { id } });
  return row ? toDto(row) : null;
}
