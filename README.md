# Retailer Search Platform

Algolia-like search and discovery platform for a 100-store big box retailer.

## Monorepo layout

```
apps/
  storefront/          Customer-facing search UI (Next.js)
  admin/               Synonyms, boost/bury rules, dashboards (Next.js)
services/
  search-api/          Keyword search, autocomplete, facets
  catalog-ingestion/   CSV/seed ingestion → Postgres + search index
  event-collector/     Search, click, filter, cart events → analytics
packages/
  shared-types/        Shared TypeScript types and Zod schemas
  config/              Typed environment configuration
  search-core/         OpenSearch-compatible search abstraction
```

## Prerequisites

- Node.js 20+
- pnpm 9+

## Commands

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm dev
```

## Status

Monorepo scaffolded. Business logic will be added in subsequent steps.
