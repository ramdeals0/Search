# Search API

HTTP service for product search, autocomplete, facets, and typo tolerance.

## Scope (Phase 1)

- `GET /search` — keyword search with filters
- `GET /autocomplete` — query suggestions
- Facet aggregation
- Merchandising rule application (synonyms, boost/bury)

## Commands

```bash
pnpm build
pnpm dev
pnpm typecheck
```

## Port

Default: `3001` (see root `.env.example`)
