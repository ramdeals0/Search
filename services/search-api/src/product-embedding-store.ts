/**
 * Backward-compatible facade for legacy imports.
 * Prefer importing from ./ai-search/* modules directly.
 */
export {
  hydrateVectorIndex as hydrateProductEmbeddingStore,
  embedProductsBatch as buildEmbeddingsFromCatalog,
  StoredVectorSearchProvider as JsonVectorSearchProvider,
} from "./ai-search/vector-index.js";
