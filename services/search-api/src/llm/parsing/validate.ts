import type { z } from "zod";
import { parseJsonSafe } from "./safe-json.js";

export function validateJsonPayload<T>(
  raw: string,
  schema: z.ZodType<T>,
): { ok: true; data: T } | { ok: false; error: string } {
  try {
    const parsed = parseJsonSafe(raw);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      return {
        ok: false,
        error: result.error.issues.map((issue) => issue.message).join("; "),
      };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

export function sanitizeQueryText(query: string, maxChars: number): string {
  return query.trim().replace(/\s+/g, " ").slice(0, maxChars);
}

export function isAdvisoryRewriteAllowed(
  originalQuery: string,
  rewrittenQuery: string,
  minConfidence: number,
  confidence: number,
): boolean {
  if (confidence < minConfidence) {
    return false;
  }

  const original = originalQuery.trim().toLowerCase();
  const rewritten = rewrittenQuery.trim().toLowerCase();
  if (!rewritten || rewritten === original) {
    return false;
  }

  return rewritten.length <= Math.max(original.length * 2, 80);
}

export function validateRerankIds(
  candidateIds: string[],
  rankedIds: string[],
): string[] | null {
  const candidateSet = new Set(candidateIds);
  if (rankedIds.length !== candidateIds.length) {
    return null;
  }

  const seen = new Set<string>();
  for (const id of rankedIds) {
    if (!candidateSet.has(id) || seen.has(id)) {
      return null;
    }
    seen.add(id);
  }

  return rankedIds;
}
