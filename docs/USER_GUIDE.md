# ForgeOps User Guide

**ForgeOps** is the operations, merchandising, and governance console for the Retailer Search Platform. It helps teams tune product search, manage merchandising rules, run experiments, and release changes safely—with a full audit trail.

This guide covers both the **customer storefront** (where shoppers search) and the **ForgeOps admin console** (where operators work).

---

## Table of contents

1. [Getting started](#1-getting-started)
2. [Roles and navigation](#2-roles-and-navigation)
3. [Customer storefront](#3-customer-storefront)
4. [Dashboard](#4-dashboard)
5. [Products workspace](#5-products-workspace)
6. [Search workspace](#6-search-workspace)
7. [Merchandising workspace](#7-merchandising-workspace)
8. [Experiments workspace](#8-experiments-workspace)
9. [Approvals and release workflow](#9-approvals-and-release-workflow)
10. [Access governance](#10-access-governance)
11. [Audit and notifications](#11-audit-and-notifications)
12. [Exports and integrations](#12-exports-and-integrations)
13. [Settings](#13-settings)
14. [Common workflows](#14-common-workflows)
15. [Demo data and sample queries](#15-demo-data-and-sample-queries)
16. [Tips and troubleshooting](#16-tips-and-troubleshooting)
17. [Production deployment (Railway)](#17-production-deployment-railway)

---

## 1. Getting started

### What you need

- A running instance of the platform (local development or Railway deployment)
- A web browser (Chrome, Edge, Firefox, or Safari)
- For **ForgeOps admin**: your sign-in credentials (or a demo account on seeded environments)

### URLs — local development

| Application | URL |
|-------------|-----|
| Storefront (shopper search) | http://localhost:3000 |
| ForgeOps admin | http://localhost:3001 |
| Search API (backend) | http://localhost:4001 |

### URLs — production (Railway)

When the platform is deployed on [Railway](https://railway.app), each component gets its own public URL from the Railway dashboard (**Settings → Networking → Generate Domain**).

| Application | Typical Railway URL pattern |
|-------------|----------------------------|
| Storefront | `https://<storefront-service>.up.railway.app` |
| ForgeOps admin | `https://<admin-service>.up.railway.app` |
| Search API | `https://<search-api-service>.up.railway.app` |

Replace the placeholders with your actual generated domains. The admin and storefront apps call the search API using `NEXT_PUBLIC_SEARCH_API_URL`, which your team configures at deploy time (see [Production deployment (Railway)](#17-production-deployment-railway)).

**Health checks (for operators):**

| Service | Path | Healthy response |
|---------|------|------------------|
| Search API | `/health` | JSON with `"ok": true` and `"database": { "connected": true, ... }` |
| ForgeOps admin | `/health` | JSON with `"ok": true`, `"service": "admin"` |
| Storefront | `/` | Storefront home page loads (HTTP 200) |

### First-time setup (fresh instance)

If the database has never been configured:

1. Open the setup wizard:
   - **Local:** http://localhost:3001/setup
   - **Production:** `https://<your-admin-domain>/setup`
2. Complete the setup wizard in order:
   - **Welcome** — overview of the instance
   - **Create admin account** — first administrator user
   - **Security defaults** — session and policy basics
   - **Platform defaults** — environment labels and defaults
   - **Review and complete** — confirm and finish
3. Sign in:
   - **Local:** http://localhost:3001/login
   - **Production:** `https://<your-admin-domain>/login`

Until setup completes, admin features return a “setup required” message. Public search and setup endpoints remain available.

**Note:** If your team ran `pnpm prisma:seed` against the production database, setup may already be complete and you can sign in with a demo account (see below) instead of running `/setup`.

### Demo environment (pre-seeded)

If your team ran the demo seed (`pnpm prisma:seed`), setup is already complete. Sign in with any demo account below.

| Email | Password | Role |
|-------|----------|------|
| merchandiser@example.com | demo123 | Merchandiser |
| reviewer@example.com | demo123 | Reviewer |
| approver@example.com | demo123 | Approver |
| releasemanager@example.com | demo123 | Release manager |
| admin@example.com | demo123 | Admin |

### Signing in

1. Go to the login page (local or production URL above)
2. Enter your email and password
3. Click **Sign in**

You are redirected to the **Dashboard** (`/admin`). Your account appears in the **bottom-left sidebar** (name, email, JIT status, Sign out).

---

## 2. Roles and navigation

### Workspace roles

ForgeOps uses role-based navigation. The **workspace role switcher** in the sidebar controls which menu items you see. This is useful for demos and testing permissions without switching accounts.

| Role | Typical responsibilities |
|------|-------------------------|
| **Merchandiser** | Edit rules, preview queries, run experiments |
| **Reviewer** | Review changes, audit trail, approvals (read/review) |
| **Approver** | Approve release requests, exports |
| **Release manager** | Promote staging to live, manage snapshots |
| **Admin** | Full access including Settings and Integrations |

**Note:** The workspace role switcher filters the UI only. API permissions still depend on your signed-in account and any active JIT elevation.

### Sidebar structure

| Section | Pages |
|---------|-------|
| **Overview** | Dashboard |
| **Catalog** | Products, Search, Zero-results inbox, Merchandising, Experiments |
| **Governance** | Approvals, Access, Audit, Notifications |
| **Operations** | Exports, Integrations, API keys, Settings |

Pages hidden for your role will not appear in the sidebar.

### Staging vs live

Search merchandising configuration exists in two environments:

- **Staging** — where you draft and test rule changes
- **Live** — what shoppers see on the storefront

Most rule editing happens in **staging**. Changes reach **live** through snapshots, approvals, and promotion (see [Approvals and release workflow](#9-approvals-and-release-workflow)).

Use the **environment switcher** on the Dashboard or Settings page to see which environment you are viewing.

---

## 3. Customer storefront

The storefront is the shopper-facing search experience. Locally it runs at **http://localhost:3000**; in production use your Railway storefront domain.

**Important:** Shoppers only see **live** merchandising configuration. Staging rule changes in ForgeOps do not affect the storefront until they are promoted to live.

### Searching for products

1. Type a query in the search bar (e.g. `cordless drill`, `mulch`, `gfci outlet`)
2. Press **Enter** or select a suggestion from autocomplete
3. Browse results on the right; use **filters** on the left
4. When there are multiple pages, use **Previous** / **Next** below the results

### Browse catalog (without a query)

**Path:** `/browse` (link: **Browse catalog** on the home page)

Use browse when shoppers want to explore the catalog by category instead of typing a search query.

1. Open **Browse catalog** from the storefront home page
2. Pick a **category** from the sidebar (or stay on **All products**)
3. Optionally filter by **brand**, **stock status**, or change **sort** (relevance, price, title)
4. Click **Apply filters** to refresh results
5. Use **Previous** / **Next** when results span multiple pages

Browse uses the search API’s browse endpoints (`/api/v1/browse` and `/api/v1/browse/categories`). It reflects the **live** product catalog, not staging merchandising rules.

### Autocomplete

As you type, the search bar suggests:

- Product titles
- Brand names
- Category names
- Corrected spellings (typo fixes)

### Filters

After searching, facet filters appear for:

- **Brand**
- **Category**
- **In stock**

Select one or more values to narrow results. Clear filters to broaden the result set again.

### Query correction

If the platform corrects a typo (e.g. `dril` → `drill`), a message shows the corrected term above the results.

### Analytics impact

Every storefront search and product click is recorded in the search API database. This data powers admin analytics, suggestions, the **Zero-results inbox**, and the **Products** insight panels. Run realistic searches during demos to populate dashboards.

---

## 4. Dashboard

**Path:** `/admin`

The dashboard is your control center.

### What you see

- **Welcome banner** — ForgeOps overview
- **Environment switcher** — staging / live context
- **Active configuration badge** — current live snapshot summary
- **Overview widgets** — recent activity highlights
- **Key metrics**
  - Active rules (staging)
  - Total searches and clicks
  - Search CTR (click-through rate)
  - Top query
  - Zero-result query count
- **Quick links** — shortcuts to every workspace

### When to use it

- Morning check-in on search health
- Confirm staging rule count before a release
- Jump quickly to Merchandising, Search, or Approvals

---

## 5. Products workspace

**Path:** `/admin/products`

Use this page to **preview how the catalog ranks** for a query and review **what shoppers search for most**.

### Search catalog

1. Enter a query (e.g. `cordless drill`, `gfci outlet`, `mulch`)
2. Click **Search**
3. Review results **above** the insight panels:
   - Total hit count
   - Applied merchandising rule names
   - Product title, brand, category, and relevance score

### Catalog insights (below search results)

Four panels show the top 10 items in each category:

| Panel | Source |
|-------|--------|
| Top searched products | Storefront clicks, or catalog popularity before traffic exists |
| Top searched brands | Click/query volume, with catalog fallback |
| Top searched queries | Recorded searches, or demo hero queries |
| Top searched categories | Click activity, or catalog popularity |

**Click any row** to run that term as a search preview.

### Tips

- Run storefront searches first so insights reflect real traffic
- Use this page before creating merchandising rules to understand current ranking
- Compare staging preview results with live storefront behavior after promotion

---

## 6. Search workspace

**Path:** `/admin/search`

Monitor query performance and get assisted recommendations.

### Analytics panel

Shows aggregate search metrics:

- Total searches and clicks
- Top queries by volume
- Zero-result queries (searches that returned no products)

**Zero-result queries** are high priority—each represents a shopper who found nothing.

### Suggestions panel

The platform analyzes search behavior and suggests actions such as:

- **Preview query** — open a ranking preview for a problematic query
- **Create rule** — start a merchandising rule for a high-traffic query
- **Create synonym** — map alternate shopper language to catalog terms (when a catalog match exists)

Each suggestion includes metrics (searches, clicks, CTR, zero-result count) and a recommended action.

Use **Copy recommendation** to share suggestion text with your team.

### Query preview

Test any query against the current staging configuration:

1. Enter a query
2. Click **Preview**
3. Review ranked products, scores, and applied rules

### Zero-results inbox

**Path:** `/admin/search/zero-results` (also embedded on the Search workspace page)

The zero-results inbox turns persistent “no results” queries into actionable fixes.

**Inbox table** — lists queries that returned zero hits, with occurrence count and last-seen time (from durable analytics, not just the current session).

**For each query:**

1. Click **Generate draft** — the platform proposes a merchandising rule (LLM-assisted when configured, heuristic fallback otherwise)
2. Review the draft in the **Rule drafts** section below the table
3. **Approve** or **Reject** the draft
4. If approved, click **Apply to staging** — the suggested rule is written to staging configuration

After applying, preview the query in **Products** or **Search**, snapshot staging, and release through the normal approval path.

**Tip:** Start here for high-volume zero-result queries before manually authoring rules in Merchandising.

---

## 7. Merchandising workspace

**Path:** `/admin/merchandising`

Manage how products rank in search results.

### Merchandising rules table

The table lists all rules in **staging** with:

- Name and ID
- Action (pin, boost, bury, hide)
- Priority
- Condition summary
- Active status

**Actions on each row:**

| Button | Effect |
|--------|--------|
| **Edit** | Open the rule form |
| **Enable / Disable** | Toggle without deleting |
| **Delete** | Remove the rule (confirmation required) |

Click **New rule** to create a rule from scratch.

### Creating or editing a rule

| Field | Description |
|-------|-------------|
| **Name** | Descriptive label (required) |
| **Action** | `Pin` (force to top), `Boost` (raise score), `Bury` (lower score), `Hide` (exclude) |
| **Priority** | Higher numbers win when multiple rules match (default 50) |
| **Active** | Whether the rule applies |
| **Condition → Query contains** | Match when the shopper query includes this text |
| **Condition → Brand** | Match products from this brand (autocomplete from catalog) |
| **Condition → Category** | Match products in this category (autocomplete from catalog) |
| **Condition → In stock** | Match only in-stock or out-of-stock products |
| **Target brand** | Apply action to all products from this brand |
| **Product IDs** | Comma-separated SKUs to pin, boost, bury, or hide |
| **Boost / Bury amount** | Score adjustment magnitude |

**Brand and Category fields** offer autocomplete from the live product catalog. Type to filter; click a suggestion to fill the field. Clear the field and save to remove a condition—empty values are not kept.

### Environment panel

Manage **staging** and **live** configuration:

- View rule and synonym counts per environment
- **Copy live → staging** — reset staging to match production baseline (requires a reason)
- **Promote staging → live** — push staging to production (requires approval in governed flows)

### Snapshots panel

Snapshots freeze a point-in-time merchandising configuration.

- **Create snapshot** — capture current staging state with name and description
- **Compare snapshots** — diff two snapshots before release
- **Rollback** — restore staging from a previous snapshot
- **Comments and annotations** — collaborate on snapshot reviews

### Suggestions panel

Same assisted suggestions as the Search workspace, available here while editing rules.

### Promotion panel

Execute or request promotion of an approved snapshot to **live**. Shows promotion history and the currently active live configuration.

### Promotions workspace and scheduled releases

**Path:** `/admin/merchandising/promotions`

The promotions workspace lists snapshot promotion activity and hosts the **Scheduled releases** panel.

**Scheduled releases panel** shows pending jobs (promote or rollback) with their scheduled time. Cancel a pending job with **Cancel** before it runs. The search-api background scheduler executes due jobs automatically (typically within about one minute of the scheduled time).

### Guided promotion workflow

**Path:** `/admin/merchandising/workflows/new-promotion`

A step-by-step wizard to promote a snapshot with targeting, review, and controlled launch:

1. **Campaign details** — name and reason
2. **Select snapshot** — choose the configuration to promote
3. **Targeting** — optional experiment link
4. **Launch timing and mode**
   - **Launch immediately** or **Schedule for later** (date/time picker)
   - **Request approval** (recommended) or **Direct promote** (emergency bypass)
5. **Review** — confirm snapshot, timing, and mode
6. **Launch** — submit approval request, promote immediately, or **Schedule promotion**

When you schedule a promotion, ForgeOps creates a `promote_snapshot` job. Approval policy is enforced when the job runs, not at schedule time.

---

## 8. Experiments workspace

**Path:** `/admin/experiments`

Test search changes scientifically before wide release.

### Query set editor

Define a set of queries to evaluate consistently (e.g. hero queries like `cordless drill`, `shop vac`).

### Experiments panel

Create and manage A/B-style search experiments comparing **baseline** and **candidate** merchandising snapshots against a saved query set.

When creating an experiment, optionally enable **Candidate LLM overrides** (candidate arm only):

| Override | Effect on candidate arm |
|----------|-------------------------|
| **Query rewrite** | LLM rewrites the shopper query before retrieval |
| **Zero-results recovery** | LLM attempts alternate queries when retrieval returns no hits |
| **LLM rerank (page 1)** | Reranks top candidates with an LLM on the first results page |

The baseline arm always uses standard search (no LLM). Overrides are useful for testing LLM features against a known snapshot before enabling them platform-wide via environment variables.

**Run experiment** executes evaluation across every query in the linked query set and records per-query outcomes. Experiments with LLM overrides may take longer per run depending on provider latency.

### Experiment run view

Execute experiment runs and inspect per-query outcomes.

### Scorecard panel

Review aggregated experiment metrics (ranking quality, coverage, etc.).

### Decision panel

Record release decisions linked to experiment evidence—feeds into the approval workflow.

---

## 9. Approvals and release workflow

**Path:** `/admin/approvals`

Governed releases require human approval before staging changes reach live search.

### Typical release path

```
Edit rules in staging
    → Create snapshot
    → Request approval (linked to snapshot)
    → Reviewer / Approver decisions
    → Promotion to live
    → Audit trail entry
```

### Approval panel

- View pending, approved, rejected, and executed requests
- Assign reviewers to a request
- Record **Approve** or **Reject** decisions with notes
- Track approval progress (e.g. 1/2 approvals required)
- Link requests to snapshots and experiments

### SLA panel

Monitor approval deadlines:

- **On track** — within SLA
- **Due soon** — approaching deadline
- **Overdue** — past deadline
- **Completed** — resolved

### Exception queue

Handle out-of-policy or expedited approval exceptions with documented justification.

### Delegation panel

Temporarily delegate approval authority to another reviewer (e.g. during PTO).

### Reviewer management

Register reviewers, set active status, and choose which reviewer identity you act as in the UI.

### Approval policy panel

Configure how many approvals are required and related policy defaults.

### Promotion panel

After approval, execute promotion of a snapshot to the live environment.

---

## 10. Access governance

**Path:** `/admin/access`

Manage who can do what in ForgeOps.

### Just-in-time (JIT) access

Request temporary elevation to a higher role (e.g. merchandiser → approver):

1. Open **JIT access**
2. Submit an elevation request with reason and duration
3. An admin or approver resolves the request
4. Active privileges appear in the sidebar account panel while elevated

### Standing access requests

Request permanent role changes through the access request workflow.

### Access reviews

Periodic certification campaigns—managers confirm users still need their access.

### Reviewer management

Shared with Approvals—configure who can review and approve governance actions.

---

## 11. Audit and notifications

### Audit

**Path:** `/admin/audit`

- **Audit log** — filterable record of merchandising, auth, approval, and access events
- **Security timeline** — chronological view of security-relevant activity

Every rule create/update/delete, promotion, login, and approval decision is logged with actor, timestamp, and outcome.

### Notifications

**Path:** `/admin/notifications`

In-app inbox for approval assignments, SLA warnings, access decisions, and system alerts. Mark items read as you work through them.

---

## 12. Exports and integrations

### Exports

**Path:** `/admin/exports` *(Approver, Release manager, Admin)*

Generate downloadable export jobs for:

- Audit trail data
- Approval records
- Governance reports

View job history and download completed exports.

### Integrations

**Path:** `/admin/integrations` *(Admin only)*

Configure **webhook endpoints** and inspect **delivery logs** for external systems (SIEM, Slack, custom automation).

### API keys

**Path:** `/admin/integrations/api-keys` *(Admin only)*

Issue scoped API keys for storefront apps, partner integrations, and automation.

**Default scopes** on new keys: `search:read`, `browse:read`, `events:write`.

**Create a key:**

1. Enter a **Name** (e.g. `storefront-prod`)
2. Optionally set **Tenant ID** and **Rate limit / minute** (default 120)
3. Click **Create key**
4. **Copy the secret immediately** — it is shown only once

**Revoke** disables a key without deleting audit history.

**Enforcing keys in production:** set `SEARCH_API_KEY_REQUIRED=true` on the search-api service. Clients must then send the key in the `X-API-Key` header (or `Authorization: Bearer <key>`) on public routes such as `/api/v1/search`, `/api/v1/browse`, and event ingestion endpoints.

---

## 13. Settings

**Path:** `/admin/settings` *(Admin only)*

- Environment switcher and active configuration
- Environment panel (copy live → staging, promote staging → live)
- Approval policy defaults
- Instance setup reference (`/setup` for fresh deployments)

---

## 14. Common workflows

### Fix a zero-result query

1. **Search** workspace or **Zero-results inbox** (`/admin/search/zero-results`) → find the query
2. In the inbox, click **Generate draft** → **Approve** → **Apply to staging**  
   *Or* open a **suggestion** / **query preview** and fix manually
3. If it is a vocabulary gap → add a **synonym** or improve catalog coverage
4. If products exist but rank poorly → create a **boost** or **pin** rule in **Merchandising**
5. **Preview** the query in Products or Search
6. **Snapshot** → **request approval** → **promote** (or **schedule** via guided promotion)

### Schedule a promotion for a future launch

1. **Merchandising** → **Guided promotion** (`/admin/merchandising/workflows/new-promotion`)
2. Complete campaign details and select the snapshot
3. On **Launch timing and mode**, choose **Schedule for later** and pick date/time
4. Choose **Request approval** or **Direct promote** (policy enforced when the job runs)
5. Click **Schedule promotion**
6. Monitor pending jobs on **Promotions** (`/admin/merchandising/promotions`) — cancel if plans change

### Test LLM search changes in an experiment

1. Create **baseline** and **candidate** snapshots in Merchandising
2. Create a **query set** with representative shopper queries
3. **Experiments** → create experiment, enable **Candidate LLM overrides** as needed
4. **Run experiment** and review the scorecard / run view
5. If results look good, promote the candidate snapshot (immediate or scheduled)

### Boost a brand for seasonal campaigns

1. **Merchandising** → **New rule**
2. Action: **Boost**, Priority: 60+
3. Condition: query contains `mulch` (or relevant season term)
4. Target brand: your campaign brand (use autocomplete)
5. Boost amount: 10–25 depending on desired strength
6. Save, preview, snapshot, and release

### Pin a hero product

1. Find the product ID in **Products** search results or catalog
2. **New rule** → Action: **Pin**, Priority: 90+
3. Condition: query contains your hero term
4. Product IDs: paste the hero SKU
5. Save and preview

### Safe rollback after a bad release

1. **Merchandising** → **Snapshots**
2. Find the last known-good snapshot
3. **Rollback** staging to that snapshot
4. Request expedited approval if needed
5. Promote to live

### Request temporary approver access

1. **Access** → **JIT access**
2. Request elevation to **Approver**
3. Wait for approval
4. Complete approval decisions
5. Privilege expires automatically

---

## 15. Demo data and sample queries

The demo catalog is synthetic home-improvement data (~1,000 products, 80+ brands).

### Storefront queries worth trying

| Query | Expected behavior |
|-------|-------------------|
| `cordless drill` | Hero drill combo pinned; in-stock drills boosted |
| `shop vac` | Synonym maps to wet/dry vacuum |
| `weed eater` | Maps to string trimmers |
| `sheetrock` | Synonym to drywall products |
| `gfci outlet` | GFCI receptacles boosted |
| `pressure washer` | Hero washer pinned |
| `miter saw` | ProSaw miter saw boosted |
| `smart thermostat` | Wi-Fi thermostats promoted |
| `mulch` | Lawn & garden seasonal boost |
| `led shop light` | Garage/workshop lighting |

### Browse categories worth exploring

| Category | What to expect |
|----------|----------------|
| **Power Tools** | Drills, saws, sanders |
| **Lawn & Garden** | Mulch, trimmers, seasonal items |
| **Electrical** | Outlets, switches, GFCI products |
| **Lighting** | Shop lights, bulbs, fixtures |

On `/browse`, try sorting by **Price: low to high** or filtering **In stock** only.

### Typo correction examples

| Type this | Corrected to |
|-----------|--------------|
| `dril` | drill |
| `cieling fan` | ceiling fan |
| `presure washer` | pressure washer |
| `shopvac` | shop vac |

---

## 16. Tips and troubleshooting

### Metrics show zero searches

Run queries on the **storefront** first. Search and click events are stored in the database; dashboards update as traffic accumulates. A fresh deploy with no storefront traffic will show zeros until shoppers (or demo searches) run queries.

### Browse page shows an API error

Confirm the search API is running and reachable at `NEXT_PUBLIC_SEARCH_API_URL`. Browse requires the same connectivity as search (`/api/v1/browse` and `/api/v1/browse/categories`). If `SEARCH_API_KEY_REQUIRED=true`, the storefront must send a valid API key (configure at the platform layer—keys are managed under **Integrations → API keys**).

### Rule change not visible on storefront

- Confirm the rule is **Active**
- Rules edit in **staging**—promote to **live** for shopper impact
- Restart is not required; promotion updates live immediately

### Brand or category not clearing on save

Clear the field completely and save. Empty condition fields are removed on save (not merged with previous values).

### Autocomplete empty in rule form

The catalog vocabulary loads from the API on page open. Confirm the search API is running:

- **Local:** http://localhost:4001/health
- **Production:** `https://<search-api-domain>/health`

### Admin or storefront cannot reach the API (production)

Symptoms: blank panels, failed login, storefront search errors, or browser requests going to `localhost:4001`.

**Cause:** The admin service cannot reach the search API (wrong `SEARCH_API_URL`, API down, or mixed-content blocking).

**Fix (platform team):**

1. Set `SEARCH_API_URL=https://<search-api-domain>` on the **admin** Railway service (runtime — redeploy to apply).
2. For **storefront**, set `NEXT_PUBLIC_SEARCH_API_URL` before build and redeploy (client bundle).
3. Verify the API: `curl https://<search-api-domain>/health`
4. In the browser devtools **Network** tab on `/login`, confirm requests go to `/search-api/api/v1/auth/login` (not `localhost:4001`).

### Admin health check failing on Railway

Symptoms: admin service deploy succeeds but Railway reports the service unhealthy.

**Common causes:**

| Cause | Fix |
|-------|-----|
| Wrong config file | Admin service must use `apps/admin/railway.toml` (not root `railway.toml`, which targets search-api). |
| Wrong start command | Must be `pnpm --filter @retailer-search/admin start` |
| Healthcheck path | Should be `/health` (root `/` always redirects to `/admin` or `/setup`). |
| `SEARCH_API_PORT` or fixed port set | Remove `SEARCH_API_PORT` on Railway; the platform injects `PORT` automatically. |

After fixes, `curl https://<admin-domain>/health` should return `{"ok":true,"service":"admin",...}`.

### Search API health check failing on Railway

1. Confirm `DATABASE_URL=${{Postgres.DATABASE_URL}}` is linked on the search-api service.
2. Do **not** set `SEARCH_API_PORT` — the API binds to Railway’s `PORT`.
3. Check `/health` for `"connected": true` and `"productCount" > 0` (run seed or complete setup if zero).

### Cannot access Settings or Integrations

These pages require **Admin** workspace role (or an admin account with JIT elevation).

### Sign-in says “setup required”

Complete the setup wizard (`/setup`) or ask your platform team to run the demo seed for a pre-configured instance.

### Rate limiting (HTTP 429)

The API limits login attempts and admin mutations. Wait for the reset time shown in response headers (`x-ratelimit-reset`).

### Session expired

Sign out and sign in again at `/login`. Default session length is 24 hours.

---

## 17. Production deployment (Railway)

This section is for **platform operators** deploying the Retailer Search Platform from GitHub to [Railway](https://railway.app). End users of ForgeOps only need the public URLs from their team.

### Architecture

Three Railway services run from the **same GitHub repository** (root directory `/` for each):

| Service | Config file | Purpose |
|---------|-------------|---------|
| **search-api** | `railway.toml` (repo root) | Search, auth, governance APIs, PostgreSQL via Prisma |
| **admin** | `apps/admin/railway.toml` | ForgeOps console (Next.js) |
| **storefront** | `apps/storefront/railway.toml` | Shopper search UI (Next.js) |

Add a **PostgreSQL** plugin in the same Railway project. Only **search-api** needs `DATABASE_URL`.

### Deploy order

1. **PostgreSQL** — create the database plugin.
2. **search-api** — deploy first; run migrations at container start; seed if needed.
3. **admin** and **storefront** — deploy after search-api has a public URL.

### search-api service

| Setting | Value |
|---------|--------|
| Root directory | `/` |
| Config file | `railway.toml` (default at repo root) |
| Start command | `pnpm --filter @retailer-search/search-api start:prod` |

**Required variables:**

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | `production` |
| `SEARCH_API_HOST` | `0.0.0.0` |

Do **not** set `SEARCH_API_PORT` on Railway.

**Optional variables (platform features):**

| Variable | Purpose |
|----------|---------|
| `SEARCH_API_KEY_REQUIRED` | Set to `true` to require API keys on public search/browse/event routes |
| `DEFAULT_API_KEY_RATE_LIMIT` | Default per-key rate limit when not set on the key (default 120/min) |
| `LLM_PROVIDER` | `openrouter`, `groq`, or `none` (default) |
| `OPENROUTER_API_KEY` / `GROQ_API_KEY` | Provider credentials when LLM features are enabled |
| `LLM_QUERY_REWRITE_ENABLED` | Enable live query rewrite (`true` / `false`) |
| `LLM_ZERO_RESULTS_ENABLED` | Enable live zero-results recovery |
| `LLM_RERANK_ENABLED` | Enable live LLM reranking |
| `HYBRID_VECTOR_ENABLED` | Enable hybrid vector retrieval stub (`true` / `false`) |

**Verify:** `GET /health` returns `"ok": true`, `"database.connected": true`, and `"productCount" > 0` after migrate/seed.

### ForgeOps admin service

| Setting | Value |
|---------|--------|
| Root directory | `/` |
| Config file | `apps/admin/railway.toml` |
| Start command | `pnpm --filter @retailer-search/admin start` |
| Healthcheck path | `/health` |

**Required variables:**

| Variable | Value |
|----------|--------|
| `SEARCH_API_URL` | `https://<search-api-domain>` |
| `NODE_ENV` | `production` |

The admin app proxies API calls through `/search-api` on the same origin. `SEARCH_API_URL` is read at **runtime** on the server (no rebuild needed when the API URL changes). Optional: `NEXT_PUBLIC_SEARCH_API_URL` for local dev fallback only.

**Verify:** `GET /health` on the admin domain returns `"service": "admin"`. Open `/login` and sign in.

### Storefront service

| Setting | Value |
|---------|--------|
| Root directory | `/` |
| Config file | `apps/storefront/railway.toml` |
| Start command | `pnpm --filter @retailer-search/storefront start` |
| Healthcheck path | `/` |

**Required variables (set before the first build):**

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_SEARCH_API_URL` | `https://<search-api-domain>` |
| `NODE_ENV` | `production` |

Redeploy storefront whenever `NEXT_PUBLIC_SEARCH_API_URL` changes.

**Verify:** Open the storefront URL and run a sample query (e.g. `cordless drill`).

### Database seed (demo data)

From a machine with repo access and `DATABASE_URL` pointing at Railway Postgres:

```bash
cd services/search-api
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
```

This loads ~1,000 demo products and the demo user accounts listed in [Demo environment](#demo-environment-pre-seeded). Seeding marks setup as complete so `/setup` is skipped.

### Operator checklist after deploy

- [ ] Search API `/health` shows database connected and products loaded
- [ ] Admin `/health` returns OK
- [ ] Admin `SEARCH_API_URL` points at the search-api public URL
- [ ] Storefront `NEXT_PUBLIC_SEARCH_API_URL` matches the search-api public URL
- [ ] Generate public domains for all three services in Railway **Networking**
- [ ] (Optional) Configure LLM provider env vars if using query rewrite, zero-results recovery, or rerank in production
- [ ] (Optional) Create API keys under ForgeOps **Integrations → API keys** and set `SEARCH_API_KEY_REQUIRED=true` if partners must authenticate

---

## Quick reference — admin routes

| Route | Purpose |
|-------|---------|
| `/admin` | Dashboard |
| `/admin/products` | Catalog search preview and insights |
| `/admin/search` | Analytics, suggestions, query preview, zero-results panel |
| `/admin/search/zero-results` | Zero-results inbox and rule draft workflow |
| `/admin/merchandising` | Rules, snapshots, environments, promotion |
| `/admin/merchandising/promotions` | Promotions workspace and scheduled releases |
| `/admin/merchandising/workflows/new-promotion` | Guided promotion (immediate or scheduled) |
| `/admin/experiments` | Query sets, experiments, scorecards |
| `/admin/approvals` | Approval queue, SLA, exceptions, delegation |
| `/admin/access` | JIT access, role requests, access reviews |
| `/admin/audit` | Audit log and security timeline |
| `/admin/notifications` | Notification inbox |
| `/admin/exports` | Export jobs |
| `/admin/integrations` | Webhooks |
| `/admin/integrations/api-keys` | API key management |
| `/admin/settings` | Environment and policy defaults |
| `/login` | Sign in |
| `/setup` | First-run instance setup |
| `/health` | Admin service health (production ops) |

**Storefront routes:**

| Route | Purpose |
|-------|---------|
| `/` | Shopper search |
| `/browse` | Category browse, filters, sort, pagination |

**Search API (backend):** `/health` — JSON status and catalog counts. Public routes include `/api/v1/search`, `/api/v1/browse`, `/api/v1/browse/categories`, and event ingestion under `/api/v1/events/*`.

---

*ForgeOps — operations, merchandising, and governance for home-improvement commerce catalogs.*
