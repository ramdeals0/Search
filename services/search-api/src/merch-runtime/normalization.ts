import type { BuildEvalContextInput, EvalContext } from "./types.js";

const WHITESPACE_RE = /\s+/g;

export function normalizeQuery(input: string): string {
  return input.trim().replace(WHITESPACE_RE, " ").toLowerCase();
}

export function canonicalizeQuery(input: string): string {
  return normalizeQuery(input);
}

export function normalizeCategoryKey(input?: string): string | undefined {
  if (input === undefined) {
    return undefined;
  }
  const normalized = input.trim().replace(WHITESPACE_RE, " ").toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeBrandKey(input?: string): string | undefined {
  if (input === undefined) {
    return undefined;
  }
  const normalized = input.trim().replace(WHITESPACE_RE, " ").toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

export function buildEvalContext(input: BuildEvalContextInput): EvalContext {
  const queryNormalized = normalizeQuery(input.query);
  const categoryKey = normalizeCategoryKey(input.categoryKey);
  const brandKeys = input.brandKeys
    ?.map((key) => normalizeBrandKey(key))
    .filter((key): key is string => key !== undefined);

  return {
    tenantId: input.tenantId,
    environment: input.environment,
    locale: input.locale?.trim() || undefined,
    channel: input.channel?.trim() || undefined,
    queryRaw: input.query,
    queryNormalized,
    queryCanonical: canonicalizeQuery(input.query),
    categoryKey,
    brandKeys: brandKeys && brandKeys.length > 0 ? brandKeys : undefined,
    nowEpochMs: input.nowEpochMs ?? Date.now(),
  };
}
