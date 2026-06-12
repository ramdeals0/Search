# Retailer Search Platform

Algolia-like search and discovery platform for a 100-store big box retailer.

## Monorepo layout

```
apps/
  storefront/          Customer-facing search UI (Next.js)
  admin/               Synonyms, boost/bury rules, dashboards (Next.js)
services/
  search-api/          Keyword search, autocomplete, facets (+ governance API)
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

## Local setup (database-backed API)

Governance features (auth, audit trail, approvals, access reviews, JIT, notifications, exports metadata) persist in **SQLite** via Prisma.

1. **Install dependencies**

```bash
pnpm install
```

2. **Environment**

Copy the example env and adjust if needed:

```bash
cp .env.example .env
cp .env.example services/search-api/.env
```

Required variables:

- `DATABASE_URL="file:./prisma/dev.db"` (relative to `services/search-api`)
- `SESSION_TTL_HOURS=24` (optional, default 24)

3. **Generate Prisma client, migrate, and seed**

From the repo root:

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

Or run all three in one step:

```bash
pnpm dev:db
```

4. **Run the apps**

```bash
pnpm dev
```

- Search API: http://localhost:4001
- Admin UI: http://localhost:3001

5. **Verify health**

```bash
curl http://localhost:4001/health
```

Expect `"database": { "connected": true, "userCount": 5 }` after seeding.

## First run setup (fresh instance)

For a **new deployment with an empty database**, initialize the instance through the setup wizard instead of seeding demo users.

1. Install dependencies and copy env files (see above).
2. Generate the Prisma client and apply migrations **without** running the seed:

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

3. Start the API and admin app:

```bash
pnpm dev
```

4. Open the admin setup wizard: http://localhost:3001/setup

5. Complete the wizard in order:
   - Welcome
   - Create the first admin account
   - Configure security defaults
   - Configure platform defaults
   - Review and complete setup

6. Sign in normally at http://localhost:3001/login

Until setup completes, normal admin API routes return HTTP **423** with `details.reason = "setup_required"`. Health, public search endpoints, and `/api/v1/setup/*` remain available.

To test bootstrap on a clean slate locally, delete `services/search-api/prisma/dev.db` and re-run migrations (do not seed).

Optional env:

- `ALLOW_SETUP=false` — disables setup and treats the instance as already configured
- `APP_NAME` — default instance label shown in the setup wizard

## Demo credentials (seeded)

| Email | Password | Role |
|-------|----------|------|
| merchandiser@example.com | demo123 | merchandiser |
| reviewer@example.com | demo123 | reviewer |
| approver@example.com | demo123 | approver |
| releasemanager@example.com | demo123 | release_manager |
| admin@example.com | demo123 | admin |

Seeded demo data also includes sample audit entries, a pending approval (`approval-seed-demo`), one notification, and an inactive webhook endpoint.

## Commands

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm dev
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev:db
```

## API hardening (rate limits & errors)

The search API applies centralized security controls in-process:

| Policy | Default | Scope |
|--------|---------|-------|
| Auth login | 5 requests / 5 minutes | Per client IP + email |
| Admin mutations | 60 requests / minute | Per authenticated user (or client IP) |
| Admin reads | 300 requests / minute | Per authenticated user (or client IP) |

**429 responses** return structured JSON:

```json
{
  "success": false,
  "code": "rate_limited",
  "message": "Too many requests...",
  "requestId": "..."
}
```

Rate-limit headers on limited routes: `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`.

**Request IDs:** Every response includes `x-request-id`. Clients may send `X-Request-Id` to correlate logs.

**Error shape:** Validation, auth, and permission failures use `ApiErrorResponseDto` with codes such as `validation_error`, `unauthenticated`, `forbidden`, `not_found`, and `internal_error`. Stack traces are never returned to clients.

Configure limits via `.env` (`RATE_LIMIT_*` variables). Set `ENFORCE_HTTPS=true` in production behind a TLS-terminating proxy.

### Hardening MVP limitations

- Rate limiting is **in-memory only** (not shared across processes or hosts).
- Limits **reset on API restart**.
- No external API gateway, WAF, or Redis-backed limiter yet.

## Known limitations

- **SQLite is for local/dev only** — switch `DATABASE_URL` to Postgres for production deployment.
- **Webhooks remain in-memory** — endpoint/delivery persistence exists in schema/seed but runtime webhook delivery is not yet DB-backed.
- **No background jobs** — export generation and webhook retries run inline in the API process.
- **No object storage for exports** — export jobs store metadata only; file content is generated on demand.
- **Some approval helpers stay in-memory** — SLA policy tweaks, assignment history, and approval exceptions are not persisted yet.
- **JIT policy is in-memory** — elevation requests persist; policy defaults reset on restart.

## Status

Core search scaffold plus governance APIs with durable SQLite persistence for auth, audit, approvals, access governance, JIT requests, collaboration, notifications, and export job metadata.
