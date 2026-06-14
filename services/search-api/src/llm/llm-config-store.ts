import type {
  LlmSettingsDto,
  LlmProviderName,
  UpdateLlmSettingsRequestDto,
  UserDto,
} from "@retailer-search/shared-types";
import type { Prisma } from "@prisma/client";
import { recordAuditLog } from "../audit-trail-store.js";
import { getSystemConfig } from "../bootstrap-store.js";
import { prisma } from "../db.js";
import { resolveDefaultModel } from "./provider.js";
import type { LlmConfig } from "./types.js";
import { invalidateLlmProviderCache } from "./provider-cache.js";

const LLM_CONFIG_KEY = "platform.llm";

interface StoredLlmConfig extends Record<string, unknown> {
  provider?: LlmProviderName;
  model?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  maxQueryChars?: number;
  rerankTopK?: number;
  debugLogging?: boolean;
  queryRewriteEnabled?: boolean;
  zeroResultsEnabled?: boolean;
  rerankEnabled?: boolean;
  updatedAt?: string;
  updatedByUserId?: string;
}

let cachedOverrides: StoredLlmConfig | null = null;

function readBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }
  return value === "true" || value === "1";
}

function readNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readProvider(value: string | undefined): LlmProviderName {
  switch ((value ?? "none").trim().toLowerCase()) {
    case "openrouter":
      return "openrouter";
    case "groq":
      return "groq";
    default:
      return "none";
  }
}

function readEnvDefaults(): LlmConfig {
  const provider = readProvider(process.env.LLM_PROVIDER);
  const model = process.env.LLM_MODEL?.trim() || resolveDefaultModel(provider);

  return {
    provider,
    model,
    timeoutMs: readNumber(process.env.LLM_TIMEOUT_MS, 4_000),
    cacheTtlMs: readNumber(process.env.LLM_CACHE_TTL_MS, 300_000),
    maxQueryChars: readNumber(process.env.LLM_MAX_QUERY_CHARS, 160),
    rerankTopK: readNumber(process.env.LLM_RERANK_TOP_K, 12),
    debugLogging: readBoolean(process.env.LLM_DEBUG_LOGGING, false),
    queryRewriteEnabled: readBoolean(process.env.LLM_QUERY_REWRITE_ENABLED, false),
    zeroResultsEnabled: readBoolean(process.env.LLM_ZERO_RESULTS_ENABLED, false),
    rerankEnabled: readBoolean(process.env.LLM_RERANK_ENABLED, false),
  };
}

function mergeConfig(overrides: StoredLlmConfig | null): LlmConfig {
  const env = readEnvDefaults();
  if (!overrides) {
    return env;
  }

  const provider = overrides.provider ?? env.provider;
  return {
    provider,
    model: overrides.model?.trim() || env.model || resolveDefaultModel(provider),
    timeoutMs: overrides.timeoutMs ?? env.timeoutMs,
    cacheTtlMs: overrides.cacheTtlMs ?? env.cacheTtlMs,
    maxQueryChars: overrides.maxQueryChars ?? env.maxQueryChars,
    rerankTopK: overrides.rerankTopK ?? env.rerankTopK,
    debugLogging: overrides.debugLogging ?? env.debugLogging,
    queryRewriteEnabled: overrides.queryRewriteEnabled ?? env.queryRewriteEnabled,
    zeroResultsEnabled: overrides.zeroResultsEnabled ?? env.zeroResultsEnabled,
    rerankEnabled: overrides.rerankEnabled ?? env.rerankEnabled,
  };
}

function isProviderReady(config: LlmConfig): boolean {
  if (config.provider === "none") {
    return false;
  }
  if (config.provider === "openrouter") {
    return Boolean(process.env.OPENROUTER_API_KEY?.trim());
  }
  if (config.provider === "groq") {
    return Boolean(process.env.GROQ_API_KEY?.trim());
  }
  return false;
}

export async function hydrateLlmConfigStore(): Promise<void> {
  cachedOverrides = await getSystemConfig<StoredLlmConfig>(LLM_CONFIG_KEY);
}

export function getLlmConfig(): LlmConfig {
  return mergeConfig(cachedOverrides);
}

export function getLlmSettings(): LlmSettingsDto {
  const config = getLlmConfig();
  return {
    ...config,
    providerReady: isProviderReady(config),
    credentials: {
      openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
      groqConfigured: Boolean(process.env.GROQ_API_KEY?.trim()),
    },
    configuredInAdmin: cachedOverrides !== null,
    updatedAt: cachedOverrides?.updatedAt,
    updatedByUserId: cachedOverrides?.updatedByUserId,
  };
}

export async function updateLlmSettings(
  input: UpdateLlmSettingsRequestDto,
  actor: UserDto,
): Promise<LlmSettingsDto> {
  const current = mergeConfig(cachedOverrides);
  const provider = input.provider ?? current.provider;
  const model =
    input.model?.trim() ||
    (input.provider !== undefined && input.model === undefined
      ? resolveDefaultModel(provider)
      : current.model);
  const next: StoredLlmConfig = {
    provider,
    model,
    timeoutMs: input.timeoutMs ?? current.timeoutMs,
    cacheTtlMs: input.cacheTtlMs ?? current.cacheTtlMs,
    maxQueryChars: input.maxQueryChars ?? current.maxQueryChars,
    rerankTopK: input.rerankTopK ?? current.rerankTopK,
    debugLogging: input.debugLogging ?? current.debugLogging,
    queryRewriteEnabled: input.queryRewriteEnabled ?? current.queryRewriteEnabled,
    zeroResultsEnabled: input.zeroResultsEnabled ?? current.zeroResultsEnabled,
    rerankEnabled: input.rerankEnabled ?? current.rerankEnabled,
    updatedAt: new Date().toISOString(),
    updatedByUserId: actor.id,
  };

  await prisma.systemConfig.upsert({
    where: { key: LLM_CONFIG_KEY },
    create: {
      key: LLM_CONFIG_KEY,
      value: next as Prisma.InputJsonValue,
    },
    update: {
      value: next as Prisma.InputJsonValue,
    },
  });

  cachedOverrides = next;
  invalidateLlmProviderCache();

  recordAuditLog({
    actionType: "update_llm_settings",
    entityType: "llm_settings",
    entityId: LLM_CONFIG_KEY,
    actorId: actor.id,
    actorLabel: actor.email,
    outcome: "success",
    summary: `LLM settings updated by ${actor.email}`,
    metadata: {
      provider: next.provider,
      model: next.model,
      queryRewriteEnabled: next.queryRewriteEnabled,
      zeroResultsEnabled: next.zeroResultsEnabled,
      rerankEnabled: next.rerankEnabled,
    },
  });

  return getLlmSettings();
}
