# Catalog Ingestion

Service for loading product catalog data from seed files or CSV into Postgres and the search index.

## Scope (Phase 1)

- CSV parsing and validation
- Normalized product schema mapping
- Postgres upsert
- Search index bulk indexing

## Commands

```bash
pnpm build
pnpm dev
pnpm typecheck
```

## Port

Default: `3003` (see root `.env.example`)
