export interface VectorSearchHit {
  productId: string;
  score: number;
}

export interface VectorSearchProvider {
  search(query: string, limit: number): Promise<VectorSearchHit[]>;
}

export class NoopVectorSearchProvider implements VectorSearchProvider {
  async search(_query: string, _limit: number): Promise<VectorSearchHit[]> {
    return [];
  }
}

export function mergeHybridScores(
  keywordScore: number,
  vectorScore: number,
  vectorWeight = 0.25,
): number {
  return keywordScore * (1 - vectorWeight) + vectorScore * vectorWeight;
}
