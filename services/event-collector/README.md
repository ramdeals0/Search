# Event Collector

Service for capturing storefront search events and exposing basic analytics endpoints.

## Scope (Phase 1)

- Track: search, click, filter, add-to-cart
- Persist events to Postgres
- Analytics: top queries, no-result queries

## Commands

```bash
pnpm build
pnpm dev
pnpm typecheck
```

## Port

Default: `3002` (see root `.env.example`)
