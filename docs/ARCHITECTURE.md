# Architecture

## Overview

TypeScript monorepo with Next.js frontends, Node.js services, Postgres for application data and analytics, and an OpenSearch-compatible search engine.

## Layers

| Layer | Responsibility |
|-------|----------------|
| `apps/storefront` | Product search, filters, autocomplete |
| `apps/admin` | Synonyms, boost/bury rules, basic dashboards |
| `services/catalog-ingestion` | Ingest CSV/seed data, normalize schema, index products |
| `services/search-api` | Query API with facets, typo tolerance, merchandising |
| `services/event-collector` | Capture events, expose analytics endpoints |
| `packages/shared-types` | Shared contracts between apps and services |
| `packages/config` | Typed environment configuration |
| `packages/search-core` | Search engine client abstraction |

## Data flow

```
CSV / seed data
    → catalog-ingestion → Postgres (catalog) + Search index
Storefront / Admin
    → search-api → Search index (+ Postgres for rules)
    → event-collector → Postgres (analytics)
```

## Principles

- Typed contracts via shared packages; Zod for external input validation
- One vertical slice at a time; each slice testable locally
- Search engine behind `search-core` abstraction (OpenSearch-compatible)
- No semantic/vector search, recommendations, or multi-tenant permissions in Phase 1

## Local development (upcoming)

Docker Compose will provide Postgres and OpenSearch. Service READMEs will document ports and env vars as each service is built.
