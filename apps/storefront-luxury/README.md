# Luxe Atelier Storefront

Luxury fashion demo storefront for **multi-catalog / multi-tenant** validation.

- **Port:** 3002 (`pnpm dev`)
- **Catalog ID:** `luxury-clothing` (sent as `X-Catalog-Id` on all search API calls)
- **Products:** 6,000 luxury clothing SKUs (seed separately — does not replace BuildMart catalog)

## Setup

```bash
# From repo root — seed luxury catalog (additive; keeps default 50K BuildMart products)
pnpm prisma:seed:luxury

# Run this storefront
pnpm --filter @retailer-search/storefront-luxury dev
```

Copy `.env.example` to `.env.local` if you need to override `SEARCH_API_URL`.

## Validate multi-tenancy

| Storefront | URL | Catalog |
|------------|-----|---------|
| BuildMart (default) | http://localhost:3000 | `default` |
| Luxe Atelier | http://localhost:3002 | `luxury-clothing` |

Search `handbag` on Luxe Atelier — expect Hermès/clutch heroes and luxury merchandising rules.
Search `cordless drill` on BuildMart — home-improvement results only.

Direct API check:

```http
GET /api/v1/search?query=silk+dress&catalogId=luxury-clothing
X-Catalog-Id: luxury-clothing
```
