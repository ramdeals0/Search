export function buildQueryUnderstandingPrompt(query: string): string {
  return [
    "You analyze e-commerce product search queries for a home-improvement catalog.",
    "Return strict JSON only with this shape:",
    "{",
    '  "intent": "short shopper intent",',
    '  "rewrittenQuery": "best literal catalog search query",',
    '  "searchTerms": ["term1", "term2"],',
    '  "categoryHint": "optional category or null",',
    '  "brandHint": "optional brand or null",',
    '  "synonyms": ["optional alternate terms"],',
    '  "confidence": 0.0',
    "}",
    "Rules:",
    "- rewrittenQuery must stay close to the original meaning",
    "- confidence is 0..1",
    "- Do not invent brands or categories not implied by the query",
    "- Prefer concise product-oriented wording",
    "",
    `Query: ${query}`,
  ].join("\n");
}
