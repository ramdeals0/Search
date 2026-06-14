import type { SearchHitDto } from "@retailer-search/shared-types";

export function buildRerankProductsPrompt(
  query: string,
  candidates: SearchHitDto[],
): string {
  const lines = candidates.map(
    (hit, index) =>
      `${index + 1}. id=${hit.id} | title=${hit.title} | brand=${hit.brand} | category=${hit.category} | score=${hit.score}`,
  );

  return [
    "You rerank e-commerce search results for relevance only.",
    "Return strict JSON only:",
    '{ "rankedProductIds": ["id1", "id2", "..."] }',
    "Rules:",
    "- Use only product ids from the candidate list",
    "- Include every candidate id exactly once",
    "- Order from most to least relevant to the query",
    "- Do not add commentary",
    "",
    `Query: ${query}`,
    "Candidates:",
    ...lines,
  ].join("\n");
}
