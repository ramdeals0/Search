import type { SearchResponseDto } from "@retailer-search/shared-types";
import type { VectorSearchHit } from "@retailer-search/search-core";

export type RetrievalSource = "lexical" | "semantic";

export interface FusedCandidate {
  productId: string;
  lexicalScore: number;
  semanticScore: number;
  rawLexicalScore: number;
  rawSemanticScore: number;
  retrievalSources: RetrievalSource[];
  lexicalHit?: SearchResponseDto["hits"][number];
}

function normalizeScore(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, value / max));
}

/**
 * Merge lexical and semantic retrieval into a deduplicated candidate set with score provenance.
 */
export function fuseRetrievalCandidates(input: {
  lexicalHits: SearchResponseDto["hits"];
  semanticHits: VectorSearchHit[];
  lexicalMax?: number;
  semanticMax?: number;
}): FusedCandidate[] {
  const lexicalMax = input.lexicalMax ?? input.lexicalHits[0]?.score ?? 1;
  const semanticMax =
    (input.semanticMax ??
      input.semanticHits.reduce((max, hit) => Math.max(max, hit.score), 0)) || 1;

  const byProductId = new Map<string, FusedCandidate>();

  for (const hit of input.lexicalHits) {
    byProductId.set(hit.id, {
      productId: hit.id,
      lexicalScore: normalizeScore(hit.score, lexicalMax),
      semanticScore: 0,
      rawLexicalScore: hit.score,
      rawSemanticScore: 0,
      retrievalSources: ["lexical"],
      lexicalHit: hit,
    });
  }

  for (const hit of input.semanticHits) {
    const existing = byProductId.get(hit.productId);
    const semanticScore = normalizeScore(hit.score, semanticMax);
    if (existing) {
      existing.semanticScore = semanticScore;
      existing.rawSemanticScore = hit.score;
      if (!existing.retrievalSources.includes("semantic")) {
        existing.retrievalSources.push("semantic");
      }
      continue;
    }
    byProductId.set(hit.productId, {
      productId: hit.productId,
      lexicalScore: 0,
      semanticScore,
      rawLexicalScore: 0,
      rawSemanticScore: hit.score,
      retrievalSources: ["semantic"],
    });
  }

  return [...byProductId.values()];
}

export function sortFusedCandidates(candidates: FusedCandidate[]): FusedCandidate[] {
  return [...candidates].sort((a, b) => {
    const scoreA = a.lexicalScore + a.semanticScore;
    const scoreB = b.lexicalScore + b.semanticScore;
    return scoreB - scoreA || a.productId.localeCompare(b.productId);
  });
}
