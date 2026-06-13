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

## Admin route structure

The **ForgeOps** admin console lives under `/admin` with a shared production-style shell (sidebar, sticky header, design tokens in `apps/admin/app/globals.css`). The root path (`/`) redirects to `/admin` after setup is complete.

| Route | Purpose |
|-------|---------|
| `/admin` | Overview dashboard — KPIs, quick links, no full feature panels |
| `/admin/products` | Catalog lookup and product search preview |
| `/admin/search` | Query analytics, suggestions, zero-results |
| `/admin/merchandising` | Merchandising command center — KPIs, live vs staging summary, quick links (no full panels) |
| `/admin/merchandising/rules` | Staging merchandising rules table and inline edit |
| `/admin/merchandising/snapshots` | Snapshot capture, diff, and rollback |
| `/admin/merchandising/promotions` | Promotion history and snapshot promotion panel |
| `/admin/merchandising/suggestions` | Analytics-backed merchandising suggestions inbox |
| `/admin/merchandising/workflows/new-rule` | Guided 6-step rule create (scope → save) |
| `/admin/merchandising/workflows/new-promotion` | Guided 6-step snapshot promotion setup |
| `/admin/merchandising/workflows/publish` | Guided 4-step staging → live publish review |
| `/admin/experiments` | Query sets, experiments, scorecards, decisions |
| `/admin/approvals` | Approval queue, SLA, exceptions, release workflow |
| `/admin/access` | JIT access, standing role requests, access reviews |
| `/admin/audit` | Audit trail and security timeline |
| `/admin/notifications` | Notification inbox |
| `/admin/exports` | Export center and job history |
| `/admin/integrations` | Webhooks and delivery logs |
| `/admin/settings` | Environment defaults and platform policies |

Setup (`/setup`) and sign-in (`/login`) sit outside the admin shell but share ForgeOps branding. Navigation items are role-filtered client-side using the workspace role selector (see `admin-nav.tsx`). **Merchandising** expands in the Catalog section to Overview, Rules, Snapshots, Promotions, and Suggestions; guided workflows are linked from the overview and workspace headers.

### ForgeOps admin branding

**Product name:** ForgeOps — operations, merchandising, and governance for large home-improvement commerce catalogs.

**Design intent:** Industrial, premium, calm B2B SaaS. Cool gray surfaces, blue accent, restrained shadows, and a custom geometric logo (forged bracket mark). No generic AI-dashboard aesthetics.

**Key UI files:**

| File | Role |
|------|------|
| `apps/admin/app/globals.css` | Design tokens, layout, cards, buttons, auth shell |
| `apps/admin/app/admin/admin-shell.tsx` | Sidebar + header shell |
| `apps/admin/app/admin/admin-nav.tsx` | Grouped navigation with icons |
| `apps/admin/app/admin/admin-page-header.tsx` | Page headers + ForgeOps logo SVG |
| `apps/admin/app/login/page.tsx` | Branded sign-in |
| `apps/admin/app/setup/page.tsx` | Branded first-run setup |

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

After running `pnpm prisma:seed`, sign in with any demo user below (password **`demo123`** for all).

| Email | Password | Role |
|-------|----------|------|
| merchandiser@example.com | demo123 | merchandiser |
| reviewer@example.com | demo123 | reviewer |
| approver@example.com | demo123 | approver |
| releasemanager@example.com | demo123 | release_manager |
| admin@example.com | demo123 | admin |

## Synthetic home improvement demo catalog

The Prisma seed generates **synthetic, non-trademark demo data** for a Home Depot–style American home improvement retailer. All product names, brands, descriptions, and placeholder images are fabricated for local demos only.

### What the seed creates

| Area | Count (approx.) |
|------|-----------------|
| Products | 1,000 (50 heroes + generated simple/variant SKUs) |
| Leaf categories | 39 |
| Synthetic brands | 80+ |
| Synonym groups | 38 |
| Typo corrections | 29 |
| Merchandising rules | 34 |
| Zero-result fallbacks | 20 |
| Query category hints | 18 |
| Hero demo queries | 18 |
| Approval requests | 12 |
| Access review runs | 2 |
| JIT elevation requests | 5 |
| Notifications | 40 |
| Comments + annotations | 60 |
| Audit trail entries | 260+ |
| Webhook endpoints + deliveries | 2 + 15 |
| Export jobs | 8 |
| Experiment definitions + runs | 5 + 8 |

The seed also writes:

- `services/search-api/prisma/seed-data/generated/catalog.json` (export artifact from seed)
- `Brand`, `Category`, and `Product` tables in Postgres (runtime catalog source)
- `SystemConfig` keys under `demo.*` (catalog, search rules, hero queries, category hints, experiments)

Running the seed marks bootstrap as **completed** so the demo admin UI works immediately without `/setup`.

### Demo search rules (home-improvement catalog)

All demo search vocabulary is aligned to the synthetic American home-improvement catalog. Grocery or international food terms from earlier prototypes are **not** included.

**Example synonym groups**

| Shopper phrase | Canonical term |
|----------------|----------------|
| shop vac | wet dry vacuum |
| weed eater | string trimmer |
| sheetrock | drywall |
| gfci outlet | ground fault outlet |
| pressure washer | power washer |
| miter saw | chop saw |
| smart thermostat | wifi thermostat |

**Example typo corrections**

| Misspelling | Corrected to |
|-------------|--------------|
| dril | drill |
| cieling fan | ceiling fan |
| presure washer | pressure washer |
| cordles drill | cordless drill |
| recepatcle | receptacle |
| shopvac | shop vac |

**Example zero-result fallbacks**

| Unusual phrase | Mapped to |
|----------------|-----------|
| hose bib | outdoor faucet |
| weed whip | string trimmer |
| sheet rock mud | drywall compound |
| garage organizer wall | wall storage rack |
| hot water tank | water heater |

**Hero demo queries** (storefront + admin)

`cordless drill`, `impact driver`, `shop vac`, `ceiling fan`, `gfci outlet`, `pressure washer`, `weed eater`, `drywall screws`, `interior paint`, `mulch`, `bathroom faucet`, `smart thermostat`, `miter saw`, `led shop light`, `water heater`, `paint sprayer`, `leaf blower`, `storage shelving`

Each hero query maps to at least one seeded hero SKU with supporting keywords, facets, and merchandising rules for ranking demos.

### Run or reset demo data

From the repo root:

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

To fully reset locally:

```bash
Remove-Item services/search-api/prisma/dev.db -Force -ErrorAction SilentlyContinue
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev
```

**Note:** Demo seed and first-run bootstrap conflict — use **either** migrate+seed for demos **or** migrate-only + `/setup` for bootstrap testing.

### Example storefront search queries

Try these on http://localhost:3000 (or your storefront port):

- `cordless drill` — pins RidgeLine combo kit; boosts in-stock drills
- `shop vac` — wet/dry vacuum synonym; buries OOS shop vacs
- `weed eater` — maps to string trimmers in Outdoor Power Equipment
- `sheetrock` — synonym to drywall panels and screws
- `gfci outlet` — boosts tamper-resistant GFCI packs
- `pressure washer` — pins hero gas washer; buries OOS units
- `miter saw` — boosts ProSaw sliding miter saw
- `smart thermostat` — promotes Wi-Fi learning thermostats
- `mulch` — seasonal lawn & garden boost
- `led shop light` — garage/workshop lighting results

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

## Merchandising runtime engine

The search API includes a low-latency, in-memory merchandising evaluator under `services/search-api/src/merch-runtime/`. It applies compiled boost/bury/pin rules to **already-retrieved search candidates** on the hot path.

### Evaluator flow

1. Build an `EvalContext` (normalized query, category/brand keys, tenant/environment).
2. Resolve the active compiled snapshot from the in-memory cache (immutable pointer swap).
3. Collect matching `RuleRef` entries via exact map lookups (`queryExactMap`, `categoryMap`, `brandMap`, `globalRules`).
4. Aggregate product effects **once per request** (`aggregateMatchedRuleEffects`).
5. Walk the candidate list once, apply score deltas and pin metadata.
6. Sort non-pinned candidates by `finalScore` descending.
7. Merge pinned items into final rank order (`mergePinnedResults`).
8. Return `EvaluatedCandidate[]` with matched rule IDs and reason codes for debugging.

### Immutable snapshot pattern

- Authoring tables and raw JSON are **not** parsed on the request path.
- Snapshots are compiled offline (or at load time) into maps: scope → rules, ruleId → effects.
- `createSnapshotManager().publish(scopeKey, snapshot)` builds a new immutable entry and swaps the active pointer in one synchronous assignment.
- Top-level snapshot objects are frozen via `freezeCompiledRuleSnapshot()` after validation.

### What “atomic swap” means in Node.js

This is **process-local application state**, not hardware atomics or `SharedArrayBuffer`:

1. Build the next compiled snapshot completely before publication.
2. Insert the new versioned entry into scope storage.
3. Assign `activeEntryKey` in a single synchronous step.
4. Readers either see the old or new snapshot reference — never a partially built graph.
5. Published snapshot objects are never mutated in place.

### Snapshot manager (request-safe reads)

Use `createSnapshotManager()` / `getDefaultSnapshotManager()` for production-style acquire/release:

```typescript
const handle = manager.acquire(scopeKey);
if (!handle) return fallback;
try {
  evaluateMerchandisingRules(context, candidates, handle.snapshot);
} finally {
  handle.release(); // idempotent
}
```

- **`acquire`** increments `inFlightReaders` and returns a stable `handle.snapshot` reference for the request lifetime.
- **`getActiveSnapshot`** returns the active snapshot without incrementing readers (peek/debug only — not for long-lived request work).
- **`publish`** marks the prior active entry inactive (TTL retirement) while in-flight readers keep the old entry resident.
- **`retire` / `invalidateScope`** prune expired or excess inactive generations.

Default limits (`DEFAULT_SNAPSHOT_MANAGER_CONFIG`):

| Setting | Default |
|---------|---------|
| `inactiveTtlMs` | 300000 (5 min) |
| `maxSnapshotsPerScope` | 3 |
| `maxTotalSnapshots` | 200 |
| `deepFreezeSnapshots` | false |

### Retirement and pruning rules

1. Never retire the **active** entry.
2. Never retire entries with **`inFlightReaders > 0`**.
3. Retire **expired inactive** entries first (`now >= expiresAtEpochMs`).
4. Enforce **`maxSnapshotsPerScope`** (keep active + newest inactive).
5. Enforce **`maxTotalSnapshots`** globally (LRU among inactive entries).
6. Enforce **`maxEstimatedBytes`** if configured (approximate structural estimate).

TTL affects **memory retirement only** — correctness does not depend on TTL.

### Versioned snapshot cache invalidation

Invalidation happens at **compiled snapshot** granularity — never per-rule or in-place mutation.

1. **Publish** creates a new versioned cache entry (`{scopeKey}@v={version}`) and sets it active.
2. **Pointer swap** updates `scopeState.activeKey` atomically (single reference write in Node.js).
3. **Previous active** is marked inactive and receives a retirement TTL (`inactiveTtlMs`, default 5 minutes).
4. **In-flight readers** increment `inFlightReaders` on acquire; inactive entries are not evicted while readers > 0.
5. **Retirement** removes expired inactive entries, then prunes by scope generation limit, global snapshot count, and optional estimated bytes.
6. **Correctness** does not depend on TTL — TTL only bounds memory for retired generations.

Default limits (centralized in `DEFAULT_SNAPSHOT_MANAGER_CONFIG` and legacy `DEFAULT_SNAPSHOT_CACHE_CONFIG`):

| Setting | Default |
|---------|---------|
| `inactiveTtlMs` | 300000 (5 min) |
| `maxSnapshotsPerScope` | 3 |
| `maxTotalSnapshots` | 200 |

### Cache key formats

**Scope key** (tenant + environment + locale + channel):

```
{tenantId}|{environment}|{locale or "_"}|{channel or "_"}
```

Example: `default|staging|_|_`

**Versioned entry key**:

```
{scopeKey}@v={version}
```

Example: `default|staging|_|_@v=demo-staging`

### Hot-path constraints

- No database access during evaluation.
- No dynamic expression interpreter.
- Exact key lookups only (no rule scanning).
- Deterministic precedence: priority-ordered refs, explicit stacking modes (`additive`, `max`, `override`).
- Shared mutable state is avoided during evaluation; only the snapshot cache pointer is shared.

### Demo / benchmark endpoints

Internal routes for local testing (not part of the public admin API):

```bash
# Run evaluator benchmark harness
curl http://localhost:4001/api/v1/internal/merch-runtime/benchmark

# Run snapshot manager publish/acquire/retirement simulation
curl http://localhost:4001/api/v1/internal/merch-runtime/snapshot/benchmark

# Inspect active snapshot version + stats by scope
curl "http://localhost:4001/api/v1/internal/merch-runtime/snapshot/stats?tenantId=default&environment=staging"

# Publish demo snapshot and inspect active version
curl -X POST "http://localhost:4001/api/v1/internal/merch-runtime/snapshot/publish-demo?version=demo-v2"

# Legacy runtime-cache benchmark/stats (still available)
curl http://localhost:4001/api/v1/internal/merch-runtime/cache/benchmark
curl http://localhost:4001/api/v1/internal/merch-runtime/cache/stats

# Evaluate demo compiled rules against retrieved candidates
curl "http://localhost:4001/api/v1/internal/merch-runtime/evaluate?query=drill&candidateLimit=20"
```

Programmatic benchmark:

```typescript
import {
  runMerchRuntimeBenchmark,
  runSnapshotManagerBenchmark,
  runSnapshotCacheBenchmark,
  formatMerchRuntimeBenchmarkReport,
  formatSnapshotManagerBenchmarkReport,
  formatSnapshotCacheBenchmarkReport,
} from "./merch-runtime/index.js";

console.log(formatMerchRuntimeBenchmarkReport(runMerchRuntimeBenchmark()));
console.log(formatSnapshotManagerBenchmarkReport(runSnapshotManagerBenchmark()));
console.log(formatSnapshotCacheBenchmarkReport(runSnapshotCacheBenchmark()));
```

Intended hot-path usage:

```typescript
const handle = manager.acquire(scopeKey);
try {
  evaluateMerchandisingRules(context, candidates, handle.snapshot);
} finally {
  handle.release();
}
```

### Runtime limitations

- Snapshot manager is **process-local only** (no Redis yet).
- No distributed invalidation or pub/sub between API instances.
- `estimatedBytes` is approximate (structural heuristic, not exact heap size).
- `deepFreezeSnapshots` is optional and mostly for discipline/debugging.
- Query normalization is lightweight (lowercase/trim); advanced synonym/typo canonicalization is not wired into runtime yet.
- Compiled snapshot production from authoring UI is a separate pipeline (loader hooks are ready for DB/Redis).

## Known limitations

- **SQLite is for local/dev only** — switch `DATABASE_URL` to Postgres for production deployment.
- **Webhooks remain in-memory** — endpoint/delivery persistence exists in schema/seed but runtime webhook delivery is not yet DB-backed.
- **No background jobs** — export generation and webhook retries run inline in the API process.
- **No object storage for exports** — export jobs store metadata only; file content is generated on demand.
- **Some approval helpers stay in-memory** — SLA policy tweaks, assignment history, and approval exceptions are not persisted yet.
- **JIT policy is in-memory** — elevation requests persist; policy defaults reset on restart.

## Status

Core search scaffold plus governance APIs with durable SQLite persistence for auth, audit, approvals, access governance, JIT requests, collaboration, notifications, and export job metadata.
