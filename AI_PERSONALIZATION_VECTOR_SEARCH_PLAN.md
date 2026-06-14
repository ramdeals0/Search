# AI Personalization & Hybrid Vector Search Plan

## Architecture overview

The platform extends the existing **lexical search core** with a modular AI retrieval layer under `services/search-api/src/ai-search/`:

```
Shopper query
    │
    ▼
Lexical retrieval (search-core) ──► normalized lexical score
    │
    ▼
Query embedding (EmbeddingProvider) ──► vector similarity scores
    │
    ▼
Hybrid merge (weighted lexical + semantic + personalization)
    │
    ▼
Merchandising rules (pins/boosts/buries/hides — unchanged)
    │
    ▼
Optional modules + experiment arm metadata
    │
    ▼
SearchResponse (+ aiRankingDebug + explanation codes in admin debug)
```

**Design principles**

- Lexical search remains authoritative; semantic and personalization layers are additive and feature-flagged.
- Configuration is stored in `SystemConfig` (`ai.ranking.config`) and can be overridden per experiment candidate arm.
- Embeddings are text-only (title, brand, category path, attributes, description).
- V1 uses **JSON vector storage + in-memory cosine scan** (compatible with Railway Postgres without pgvector). A pgvector backend can be added behind the same `StoredVectorSearchProvider` interface.

## Schema changes

Migration: `services/search-api/prisma/migrations/20260616120000_ai_hybrid_search/migration.sql`

| Model / field | Purpose |
|---------------|---------|
| `ProductEmbedding` + `textHash`, `model`, `provider`, `dimensions` | Idempotent product vectors with change detection |
| `EmbeddingJob` | Backfill / incremental / reindex job tracking |
| `ExperimentRecord.candidateAiConfig` | Candidate-arm AI overrides for online A/B |
| `ShopperProfile.affinities` (JSON) | Extended profile: products, brands, categories, recent queries |

## API changes

| Endpoint | Description |
|----------|-------------|
| `GET/PATCH /api/v1/admin/ai-search/config` | AI ranking settings (audited) |
| `GET/POST /api/v1/admin/ai-search/embedding-jobs` | Trigger and inspect embedding jobs |
| `GET /api/v1/admin/ai-search/embedding-coverage` | Coverage stats |
| `GET /api/v1/admin/ai-search/query-preview` | Preview modes: lexical, hybrid, hybrid+personalization, semantic rescue |
| `GET /api/v1/search` | Extended response with `rankingMode`, `aiRankingDebug`, extended `rankingDebug` |

Backward compatibility: existing clients ignore new optional fields.

## Admin console

| Surface | Path |
|---------|------|
| AI Search settings | `/admin/ai-search` |
| Query preview modes | Search workspace (`query-preview.tsx`) |
| Score breakdown | `ranking-score-breakdown.tsx` (semantic/personalization/explanations) |
| Experiment candidate AI | Experiments panel |

## Storefront

- No shopper-visible AI messaging.
- Existing `x-session-id` header drives personalization.
- Hybrid ranking is transparent via standard `/api/v1/search`.

## Rollout plan

1. **Local / staging**
   - Apply migration: `pnpm exec prisma migrate deploy`
   - Set `HYBRID_SEARCH_ENABLED=true`, `EMBEDDINGS_PROVIDER=mock`
   - Run embedding backfill from **AI Search → Reindex**
   - Validate preview modes in Search workspace

2. **Production (Railway)**
   - Deploy search-api with env vars (see below)
   - Start with `SEMANTIC_SEARCH_ENABLED=false`, validate lexical parity
   - Enable semantic retrieval at low traffic; monitor `/health` and embedding job logs
   - Configure online experiment with candidate `candidateAiConfig` for controlled rollout

3. **Governance**
   - AI config changes write audit entries (`update_ai_ranking_config`)
   - Tie candidate snapshots + experiment arms to promotions workflow (existing ForgeOps pattern)

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `HYBRID_SEARCH_ENABLED` | false | Master hybrid pipeline toggle |
| `SEMANTIC_SEARCH_ENABLED` | false | Semantic retrieval |
| `PERSONALIZATION_ENABLED` | true | Session/profile boosts |
| `SEMANTIC_ZERO_RESULTS_FALLBACK_ENABLED` | true | Semantic rescue when lexical hits are low |
| `SEMANTIC_FALLBACK_MIN_HITS` | 3 | Threshold for rescue |
| `EMBEDDINGS_PROVIDER` | mock | mock \| openai \| openrouter |
| `EMBEDDINGS_MODEL` | mock-hash-v1 | Model name |
| `EMBEDDINGS_API_KEY` | — | Provider API key |
| `EMBEDDINGS_BASE_URL` | provider default | OpenAI-compatible base URL |
| `EMBEDDING_DIMENSIONS` | 64 | Vector size (mock) |
| `EMBEDDING_BATCH_SIZE` | 32 | Batch size for indexing |
| `PRODUCT_EMBEDDINGS_ENABLED` | true | Allow embedding persistence |
| `LEXICAL_WEIGHT` / `SEMANTIC_WEIGHT` / `PERSONALIZATION_WEIGHT` | 0.55 / 0.30 / 0.15 | Ranking weights |
| `PERSONALIZATION_LOOKBACK_DAYS` | 30 | Profile window |
| `PERSONALIZATION_DECAY_HALF_LIFE_DAYS` | 14 | Recency decay |

Legacy: `HYBRID_VECTOR_ENABLED=true` still enables hybrid defaults.

## Known limitations (V1)

- **No pgvector ANN index** — semantic retrieval scans in-memory vectors (acceptable for ~50k SKUs; migrate to pgvector/OpenSearch for larger catalogs).
- **Mock provider** uses deterministic hashed vectors, not ML semantics — use OpenAI/OpenRouter for real semantic quality.
- **LLM and hybrid** — when LLM features are enabled and hybrid is disabled, legacy LLM path still runs; when hybrid is enabled, hybrid pipeline takes precedence.
- **No image/multimodal embeddings**.
- **Embedding jobs** run inline in the API process (no separate worker queue yet).
- **Personalization** is session-scoped; authenticated shopper ID merge is a future enhancement.

## Next steps

1. Add **pgvector** column + IVFFlat/HNSW index on Railway Postgres for sub-linear retrieval.
2. Background worker (Railway cron or queue) for embedding jobs at catalog scale.
3. Unified **LLM rerank on hybrid results** (single pipeline).
4. Offline evaluation metrics: semantic recovery rate, nDCG with AI explanations.
5. **Multimodal embeddings** (product images) as a separate provider implementing the same interface.

## Assumptions

- Railway Postgres JSON storage is sufficient for V1 vectors at 50k products.
- OpenAI-compatible `/embeddings` endpoint is used for openai/openrouter providers.
- Admin-only explainability is sufficient for V1; storefront remains non-technical.
