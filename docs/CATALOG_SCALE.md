# Catalog Scale Architecture (up to 80M products)

The platform supports catalogs up to **80,000,000** products using a dual-mode catalog architecture.

## Modes

| Mode | When | Behavior |
|------|------|----------|
| **in_memory** | Product count ≤ `CATALOG_IN_MEMORY_THRESHOLD` (default 100,000) | Full catalog loaded at startup; inverted index in RAM (existing MVP path) |
| **database** | Product count > threshold | Query-time PostgreSQL retrieval; no full RAM load |

Check mode via `GET /health`:

```json
{
  "database": {
    "productCount": 80000000,
    "catalogScaleMode": "database",
    "maxCatalogProducts": 80000000
  }
}
```

## Database-backed search

When in **database** mode:

1. **Lexical retrieval** — PostgreSQL full-text search (`to_tsvector` / `plainto_tsquery`) with GIN indexes, returning up to `CATALOG_SEARCH_CANDIDATE_LIMIT` candidates (default 5,000)
2. **Ranking** — Existing merchandising + hybrid pipeline runs on the candidate set only (not the full catalog)
3. **Browse** — SQL `WHERE` / `ORDER BY` / `LIMIT` pagination
4. **Autocomplete** — Trigram/prefix queries on title, brand, category
5. **Embeddings** — Cursor-based batch jobs; optional **pgvector HNSW** ANN index for semantic search

Migration: `prisma/migrations/20260617120000_large_catalog_scale/`

## Semantic / vector search at scale

| Feature | Small catalog | Large catalog |
|---------|---------------|---------------|
| Embedding storage | JSON + in-memory map | JSON + `embeddingVector` pgvector column |
| Vector query | In-memory cosine scan | pgvector `<=>` ANN (or candidate-scoped search) |
| Embedding jobs | In-memory product list | DB cursor batches (`CATALOG_DB_BATCH_SIZE`) |

Enable pgvector on Railway Postgres, then run embedding reindex from ForgeOps **AI Search**.

## Seeding large catalogs

| Target size | Seed path |
|-------------|-----------|
| ≤ 100,000 | Standard seed (`generateProductCatalog` + `catalog.json`) |
| > 100,000 | Streaming seed (`seedLargeCatalogTables`) — no full JSON artifact |

```bash
# Example: 5M product load test (requires time and disk)
TARGET_PRODUCT_COUNT=5000000 CATALOG_SEED_BATCH_SIZE=5000 pnpm exec prisma db seed
```

For production-scale ingestion (millions+), use your ETL pipeline with batched `Product` inserts and run the large-catalog migration first.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CATALOG_IN_MEMORY_THRESHOLD` | 100000 | Switch to database mode above this count |
| `CATALOG_SEARCH_CANDIDATE_LIMIT` | 5000 | Max lexical candidates per search query |
| `CATALOG_DB_BATCH_SIZE` | 1000 | Embedding job / DB iteration batch size |
| `CATALOG_VECTOR_SEARCH_LIMIT` | 500 | Max semantic hits from pgvector |
| `CATALOG_SEED_BATCH_SIZE` | 2000 | Products per seed insert batch |
| `TARGET_PRODUCT_COUNT` | 30000 | Demo seed size (max 80M) |
| `CATALOG_THEME` | `fleet-farm` | Catalog theme (`fleet-farm` or `home-improvement`) |

## Operational notes

- **Restart search-api** after large seed completes so it detects database mode from count.
- **Do not** expect sub-second cold startup with 80M products — startup only counts rows, it does not load them.
- **Merchandising rules** still apply on the candidate result set in database mode.
- **Facets** in database mode are computed on the candidate set (same as hybrid on subset).
- For extreme scale, consider external OpenSearch — this release targets PostgreSQL-native scale to 80M.

## Related docs

- [DEVELOPER_API_GUIDE.md](./DEVELOPER_API_GUIDE.md) — API reference
- [AI_PERSONALIZATION_VECTOR_SEARCH_PLAN.md](../AI_PERSONALIZATION_VECTOR_SEARCH_PLAN.md) — hybrid ranking
