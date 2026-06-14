export function normalizeSearchQuery(rawQuery: string): string {
  return rawQuery.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildRetrievalQuery(
  rawQuery: string,
  advisoryRewrite?: string,
): string {
  const base = rawQuery.trim();
  const rewrite = advisoryRewrite?.trim();
  return rewrite && rewrite.length > 0 ? rewrite : base;
}
