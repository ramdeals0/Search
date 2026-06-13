# Storefront

Customer-facing search and discovery UI (Next.js).

## Scope (Phase 1)

- Search bar with autocomplete
- Results grid with facets/filters
- Product click and add-to-cart event emission

## Commands

```bash
pnpm build
pnpm dev
pnpm typecheck
```

## Deploy to Railway

1. In your Railway project, add a **new service** from the same GitHub repo (root `/`).
2. **Settings → Config-as-code → Railway config file:** `apps/storefront/railway.toml`
3. Set variables **before** the first build:
   - `NEXT_PUBLIC_SEARCH_API_URL=https://<your-search-api>.up.railway.app`
   - `NODE_ENV=production`
4. Deploy. Healthcheck hits `/`.

Build/start commands are defined in `railway.toml` (`pnpm --filter @retailer-search/storefront... build` / `start`).
