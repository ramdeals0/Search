export interface QueryProcessorConfig {
  phraseSynonyms?: Array<[string, string]>;
  tokenSynonyms?: Record<string, string>;
  phraseTypos?: Record<string, string>;
  tokenTypos?: Record<string, string>;
}

export interface ProcessedQuery {
  normalizedQuery: string;
  correctedQuery?: string;
  searchQuery: string;
}

export interface ProductSearchIndexStats {
  productCount: number;
  tokenCount: number;
  lastRebuiltAt?: string;
  lastIncrementalAt?: string;
}
