export function buildZeroResultsRewritePrompt(query: string): string {
  return [
    "You help recover zero-result e-commerce searches for a home-improvement catalog.",
    "Return strict JSON only:",
    '{ "rewrites": ["broader rewrite 1", "broader rewrite 2", "broader rewrite 3"] }',
    "Rules:",
    "- Provide exactly 3 progressively broader rewrites",
    "- Keep rewrites short and product-searchable",
    "- Do not change the shopper intent drastically",
    "- Avoid brand names unless present in the original query",
    "",
    `Original query: ${query}`,
  ].join("\n");
}
