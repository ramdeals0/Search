# ForgeOps User Guide

**ForgeOps** is the operations, merchandising, and governance console for the Retailer Search Platform. It helps teams tune product search, manage merchandising rules, run experiments, configure **AI-powered hybrid ranking and personalization**, and release changes safely—with a full audit trail.

This guide covers both the **customer storefront** (where shoppers search) and the **ForgeOps admin console** (where operators work).

**Developers** integrating against the REST API should see [DEVELOPER_API_GUIDE.md](./DEVELOPER_API_GUIDE.md). For catalogs above 100K products (up to 80M), see [CATALOG_SCALE.md](./CATALOG_SCALE.md).

The demo environment includes **two product catalogs** and **two storefronts** so you can validate multi-catalog / multi-tenant behavior locally (see [Multi-catalog platform](#19-multi-catalog-platform)).

---

## Table of contents

1. [Getting started](#1-getting-started)
2. [Roles and navigation](#2-roles-and-navigation)
   - [How roles work](#how-roles-work)
   - [Demo accounts by role](#demo-accounts-by-role)
   - [Permission matrix](#permission-matrix)
   - [Sidebar visibility by role](#sidebar-visibility-by-role)
   - [Role summaries](#role-summaries)
   - [JIT elevation](#jit-elevation)
   - [Admin-only API actions](#admin-only-api-actions)
   - [Staging vs live](#staging-vs-live)
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
14. [AI Search and personalization](#14-ai-search-and-personalization)
15. [Common workflows](#15-common-workflows)
16. [Demo data and sample queries](#16-demo-data-and-sample-queries)
17. [Tips and troubleshooting](#17-tips-and-troubleshooting)
18. [Production deployment (Railway)](#18-production-deployment-railway)
19. [Multi-catalog platform](#19-multi-catalog-platform)

---

## 1. Getting started

### What you need

- A running instance of the platform (local development or Railway deployment)
- A web browser (Chrome, Edge, Firefox, or Safari)
- For **ForgeOps admin**: your sign-in credentials (or a demo account on seeded environments)

### URLs — local development

| Application | URL |
|-------------|-----|
| Storefront — BuildMart (default catalog) | http://localhost:3000 |
| Storefront — Luxe Atelier (luxury catalog) | http://localhost:3002 |
| ForgeOps admin | http://localhost:3001 |
| Search API (backend) | http://localhost:4001 |

### URLs — production (Railway)

When the platform is deployed on [Railway](https://railway.app), each component gets its own public URL from the Railway dashboard (**Settings → Networking → Generate Domain**).

| Application | Typical Railway URL pattern |
|-------------|----------------------------|
| Storefront | `https://<storefront-service>.up.railway.app` |
| ForgeOps admin | `https://<admin-service>.up.railway.app` |
| Search API | `https://<search-api-service>.up.railway.app` |

Replace the placeholders with your actual generated domains. The admin and storefront apps call the search API using `NEXT_PUBLIC_SEARCH_API_URL`, which your team configures at deploy time (see [Production deployment (Railway)](#18-production-deployment-railway)).

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

To add the **luxury clothing catalog** (6,000 products) without replacing BuildMart data, run `pnpm prisma:seed:luxury` after the main seed. Restart search-api afterward so it reloads catalog counts.

### Demo environment (pre-seeded)

If your team ran the demo seed (`pnpm prisma:seed`), setup is already complete. Sign in with any demo account below.

| Email | Password | Standing role |
|-------|----------|---------------|
| merchandiser@example.com | demo123 | Merchandiser |
| reviewer@example.com | demo123 | Reviewer |
| approver@example.com | demo123 | Approver |
| releasemanager@example.com | demo123 | Release manager |
| developer@example.com | demo123 | Developer |
| admin@example.com | demo123 | Admin |

### Signing in

1. Go to the login page (local or production URL above)
2. Enter your email and password
3. Click **Sign in**

You are redirected to the **Dashboard** (`/admin`). Your account appears in the **bottom-left sidebar** (name, email, JIT status, Sign out).

---

## 2. Roles and navigation

### How roles work

ForgeOps uses three related concepts:

| Concept | What it is | Where you see it |
|---------|------------|------------------|
| **Standing role** | Your account’s permanent role | Bottom-left sidebar after sign-in |
| **Effective role** | Standing role, or a **higher** role while JIT elevation is active | API permission checks, `/api/v1/auth/me` |
| **Workspace role** | UI filter selected in the **workspace role switcher** | Sidebar navigation only |

The **workspace role switcher** is useful for demos: you can preview what a merchandiser or reviewer sees without signing out. It does **not** by itself grant API permissions—mutations still depend on your signed-in account and any active JIT privilege.

### Demo accounts by role

Use the demo seed accounts from [Getting started](#demo-environment-pre-seeded) to test each role. Sign in with the matching email, or stay signed in as admin and switch the **workspace role** to preview navigation.

### Workspace roles

| Role | Typical responsibilities |
|------|-------------------------|
| **Merchandiser** | Edit staging rules and synonyms, snapshots, search preview, merchandising workflows |
| **Reviewer** | Review changes, read approvals, comment on requests |
| **Approver** | Approve or reject release requests |
| **Release manager** | Execute approved releases, promote staging to live, manage snapshots |
| **Developer** | Self-service API keys and usage in the developer portal |
| **Admin** | Full access including platform catalogs, all API keys, AI Search save/reindex |

### Permission matrix

This table reflects **intended** access from the platform RBAC model. Your **effective role** (including JIT) is what the API enforces on protected endpoints. Some pages are visible to all signed-in users, but sensitive actions inside them may still require admin.

| Capability | Merch | Reviewer | Approver | Release mgr | Developer | Admin |
|------------|:-----:|:--------:|:--------:|:-----------:|:---------:|:-----:|
| View dashboard and search analytics | Yes | Yes | Yes | Yes | Yes | Yes |
| Preview queries (Search / Products) | Yes | Yes | Yes | Yes | Yes | Yes |
| Create or edit merchandising rules (staging) | Yes | No | No | No | No | Yes |
| Manage synonyms (staging) | Yes | No | No | No | No | Yes |
| Create or restore snapshots | Yes | No | No | Yes | No | Yes |
| Manage saved views | Yes | No | No | No | No | Yes |
| Comment / annotate on workflows | Yes | Yes | Yes | Yes | No | Yes |
| View approvals inbox | No | Yes | Yes | Yes | No | Yes |
| Approve or reject release requests | No | No | Yes | No | No | Yes |
| Execute approved releases to live | No | No | No | Yes | No | Yes |
| Promote staging configuration to live | No | No | No | Yes | No | Yes |
| View audit trail / security timeline | No | No | No | Yes | No | Yes |
| Manage reviewers and approval policy | No | No | No | No | No | Yes |
| Zero-results inbox and rule drafts | Yes | Yes | Yes | Yes | Yes | Yes |
| Experiments workspace | Yes | Yes | Yes | Yes | Yes | Yes |
| Exports and integrations (pages) | Yes | Yes | Yes | Yes | Yes | Yes |
| Developer portal (own API keys) | No | No | No | No | Yes | Yes |
| View API usage metrics | No | No | No | No | Yes | Yes |
| Manage all API keys (integrations) | No | No | No | No | No | Yes |
| Platform catalogs and plugins | No | No | No | No | No | Yes |
| Branding settings | No | No | No | No | No | Yes |
| Save AI Search settings | No | No | No | No | No | Yes |
| Trigger embedding reindex | No | No | No | No | No | Yes |
| LLM provider settings | No | No | No | No | No | Yes |

### Sidebar visibility by role

These pages are **hidden in the sidebar** when your workspace role switcher is set below the required role. The **Admin** workspace role always sees every item.

| Page / area | Merch | Reviewer | Approver | Release mgr | Developer | Admin |
|-------------|:-----:|:--------:|:--------:|:-----------:|:---------:|:-----:|
| Dashboard, Products, Search, AI Search, Zero-results, Experiments | Yes | Yes | Yes | Yes | Yes | Yes |
| Merchandising (rules, synonyms, snapshots, promotions, workflows) | Yes | Yes | Yes | Yes | Yes | Yes |
| Approvals, Access, Audit, Notifications | Yes | Yes | Yes | Yes | Yes | Yes |
| Exports, Integrations, Settings | Yes | Yes | Yes | Yes | Yes | Yes |
| **Integrations → API keys** | No | No | No | No | No | **Yes** |
| **Integrations → API usage** | No | No | No | No | **Yes** | **Yes** |
| **Developer portal** | No | No | No | No | **Yes** | **Yes** |
| **Platform → Catalogs** | No | No | No | No | No | **Yes** |
| **Platform → Plugins** | No | No | No | No | No | **Yes** |

### Role summaries

| Role | Can do | Cannot do |
|------|--------|-----------|
| **Merchandiser** | Edit staging rules, synonyms, and snapshots; preview search; run merchandising workflows | Approve or execute releases, promote to live, platform/API admin, save AI Search settings or reindex |
| **Reviewer** | View approvals, comment, review audit context | Edit merchandising rules, approve or execute releases, promote live |
| **Approver** | Approve or reject release requests; view approvals | Edit rules or synonyms; execute or promote to live without release-manager rights |
| **Release manager** | Execute approved releases, promote staging to live, snapshots, view audit | Day-to-day merchandising rule editing (merchandiser work) |
| **Developer** | Own API keys, API usage dashboard, developer portal | Merchandising changes, approvals workflow, platform admin |
| **Admin** | Everything, including AI Search configuration, embedding reindex, LLM settings, catalogs, and all API keys | — |

### JIT elevation

**Just-in-time (JIT) access** temporarily raises your **effective role** for permission-checked API calls—for example, letting a merchandiser act as an approver for a limited time.

| Situation | Effect |
|-----------|--------|
| Merchandiser with active JIT to **Approver** | Can perform approver actions where the API checks `approve_release` |
| JIT to **Admin** | Elevates permission checks that use **effective role** |
| Endpoints that require **standing admin** (`user.role === "admin"`) | JIT does **not** apply—you must sign in as `admin@example.com` |

Standing-admin-only actions include **Save AI Search settings**, **Reindex embeddings**, and **LLM provider settings**. Request JIT from the bottom-left sidebar or **Access → JIT elevation**.

See [Access governance](#10-access-governance) for the full JIT workflow.

### Admin-only API actions

Even when the sidebar shows a page to all roles, these mutations require a **standing admin** account (not JIT alone):

- Patch AI Search configuration (`/admin/ai-search`)
- Queue embedding reindex jobs
- Update LLM provider settings
- Manage all API keys (admin integrations)
- Some platform catalog and branding mutations

Merchandisers can **view** AI Search coverage and metrics; saving config or starting reindex needs `admin@example.com` (or equivalent production admin).

### Sidebar structure

| Section | Pages |
|---------|-------|
| **Overview** | Dashboard |
| **Catalog** | Products, Search, **AI Search**, Zero-results inbox, Merchandising, Experiments |
| **Governance** | Approvals, Access, Audit, Notifications |
| **Operations** | Exports, Integrations, API keys, Developer portal, Settings |
| **Platform** | Catalogs (multi-catalog registry), Plugins |

Pages hidden for your workspace role will not appear in the sidebar.

### Staging vs live

Search merchandising configuration exists in two environments:

| | Staging | Live (storefront) |
|---|---------|-------------------|
| **Who edits** | Merchandiser+ in ForgeOps | No direct editing |
| **What shoppers see** | Preview and query tools only | Production search results |

- **Staging** — where you draft and test rule changes
- **Live** — what shoppers see on the storefront

Most rule editing happens in **staging**. Changes reach **live** through snapshots, approvals, and promotion (see [Approvals and release workflow](#9-approvals-and-release-workflow)).

Use the **environment switcher** on the Dashboard or Settings page to see which environment you are viewing.

---

## 3. Customer storefront

The platform ships with **two demo storefronts** for multi-catalog validation. Each storefront sends an `X-Catalog-Id` header on every search and browse request so results stay isolated to that retailer’s catalog.

| Storefront | Local URL | Catalog ID | Branding |
|------------|-----------|------------|----------|
| **BuildMart** | http://localhost:3000 | `default` | Home improvement & tools (~50,000 products) |
| **Luxe Atelier** | http://localhost:3002 | `luxury-clothing` | Luxury fashion (~6,000 products; seed separately) |

In production, deploy one or more storefront services—each with its own `NEXT_PUBLIC_CATALOG_ID`—pointing at the same search API.

**Important:** Shoppers only see **live** merchandising configuration. Staging rule changes in ForgeOps do not affect the storefront until they are promoted to live.

### Start the luxury storefront locally

```bash
pnpm prisma:seed          # BuildMart catalog (if not already seeded)
pnpm prisma:seed:luxury   # Adds luxury-clothing catalog (additive)
pnpm --filter @retailer-search/storefront-luxury dev
```

Restart **search-api** after seeding so it reloads products and merged merchandising rules.

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

Browse uses the search API’s browse endpoints (`/api/v1/browse` and `/api/v1/browse/categories`). It reflects the **live** product catalog for the storefront’s catalog ID, not staging merchandising rules.

On **Luxe Atelier**, browse categories are **Women**, **Men**, and **Accessories** instead of home-improvement departments.

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

### Personalization (transparent to shoppers)

When your platform operator enables hybrid search and personalization, the storefront may rank results using recent shopper activity—searches, clicks, and commerce events—in addition to keyword relevance. Shoppers do **not** see AI labels or score breakdowns; the experience remains a normal product search.

Personalization is tied to a **session cookie** on the storefront. Repeat visits in the same browser session can reflect prior interests (for example, boosting brands or categories the shopper clicked earlier). No account sign-in is required for session-based personalization.

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
- Jump quickly to Merchandising, Search, **AI Search**, or Approvals

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
   - **Score breakdown** (when hybrid search is enabled): expand a result to see lexical, semantic, and personalization contributions, plus explanation chips (e.g. *Lexical match*, *Semantic match*, *Brand affinity*)

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
2. Choose a **preview mode** (see below)
3. Optionally enter a **session ID** to simulate personalization for a known shopper session
4. Click **Preview**
5. Review ranked products, scores, applied rules, explanation chips, and the score breakdown drawer

**Preview modes**

| Mode | What it shows |
|------|----------------|
| **Lexical only** | Keyword retrieval and merchandising rules—baseline behavior without semantic or personalization layers |
| **Hybrid** | Weighted merge of lexical + semantic similarity |
| **Hybrid + personalization** | Hybrid ranking plus session profile affinities (brand, category, product history) |
| **Semantic rescue** | Highlights zero-results recovery when lexical hits are below the configured threshold |

When hybrid search is active, the preview summary shows ranking weights (lexical / semantic / personalization), semantic hit counts, and whether **semantic recovery** was applied. Each result can display **explanation chips** such as *Lexical match*, *Semantic match*, *Brand affinity*, *Merchandising rule*, or *Semantic recovery*.

For platform-wide AI settings and embedding coverage, use the [**AI Search** workspace](#14-ai-search-and-personalization).

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

**Candidate AI ranking overrides** (candidate arm only) let you compare hybrid lexical + semantic search against baseline without changing platform defaults:

| Override | Effect on candidate arm |
|----------|-------------------------|
| **Semantic retrieval** | Enable vector similarity on product text embeddings |
| **Personalization** | Apply session profile affinities during ranking |
| **Weight preset** | Choose a preset (balanced, semantic-heavy, personalization-heavy, lexical-heavy) or custom lexical / semantic / personalization weights |
| **Embedding model** | Optional override of the embeddings model used for the candidate arm |

When both LLM and AI overrides are configured, the experiment run uses the candidate snapshot plus whichever candidate-arm features are enabled. Review per-query outcomes in the run view to compare baseline vs candidate ranking.

**Run experiment** executes evaluation across every query in the linked query set and records per-query outcomes. Experiments with LLM or AI overrides may take longer per run depending on provider latency and embedding coverage.

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

Every rule create/update/delete, promotion, login, approval decision, and **AI ranking configuration change** is logged with actor, timestamp, and outcome. Filter the audit log for `update_ai_ranking_config` to review who changed hybrid search settings and when.

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
- Link to the dedicated [**AI Search**](#14-ai-search-and-personalization) page for hybrid ranking configuration
- Link to [**Platform → Catalogs**](#19-multi-catalog-platform) for multi-catalog registry management

---

## 14. AI Search and personalization

**Path:** `/admin/ai-search`

Configure **text-only** AI-enhanced search: product embeddings, hybrid lexical + semantic ranking, session personalization, and embedding index maintenance. Lexical keyword search always remains available; AI layers are additive and can be rolled out gradually.

**Who should use this page:** Merchandisers testing ranking changes, platform operators enabling production hybrid search, and admins reviewing embedding coverage before launch.

### How hybrid ranking works

When hybrid search is enabled, each query goes through:

1. **Lexical retrieval** — existing keyword scoring (unchanged core)
2. **Semantic retrieval** — query and product text embeddings compared for similarity
3. **Personalization** — optional boosts from recent searches, clicks, add-to-cart, and purchase signals in the shopper session
4. **Merchandising rules** — pins, boosts, buries, and hides still apply on top (pins override rank as today)

Final ranking combines normalized lexical, semantic, and personalization scores using configurable weights. When lexical results are sparse, **semantic zero-results fallback** can recover related products.

Product embeddings use **text only** (title, brand, category, attributes, description)—no image or multimodal embeddings in the current release.

### AI Search settings panel

| Control | Purpose |
|---------|---------|
| **Embeddings provider** | `mock` (deterministic dev/test), `openai`, or `openrouter` |
| **Embeddings model** | Model name for the provider (e.g. `text-embedding-3-small`) |
| **Embedding dimensions / batch size** | Vector size and indexing batch size |
| **Semantic fallback min hits** | When lexical hits fall below this count, semantic rescue may apply |
| **Personalization lookback / decay** | How far back session signals count and how quickly they fade |
| **Ranking weights** | Lexical, semantic, and personalization contributions (normalized on save) |
| **Hybrid search enabled** | Master toggle for the hybrid pipeline |
| **Semantic retrieval enabled** | Turn vector similarity on or off |
| **Personalization enabled** | Turn session affinity boosts on or off |
| **Semantic zero-results fallback** | Allow semantic recovery for low-hit queries |
| **Product embeddings enabled** | Persist and use product embedding vectors |

**Coverage cards** show how many catalog products have embeddings vs total products, plus the active model and provider.

### Embedding index (reindex)

Before semantic search is useful in non-mock environments, products need embeddings:

1. Open **AI Search** (`/admin/ai-search`)
2. Confirm **Product embeddings enabled** is checked
3. Click **Start reindex** (or **Reindex all products**)
4. Monitor **Recent embedding jobs** for status (`pending`, `running`, `completed`, `failed`)

Reindex jobs are idempotent: unchanged product text is skipped using a content hash. After a large catalog seed (~50,000 products), the first backfill may take several minutes depending on provider rate limits.

**Local development tip:** use `EMBEDDINGS_PROVIDER=mock` so reindex completes quickly without an external API key.

### Explainability in ForgeOps

Operators see AI reasoning in admin preview surfaces—not on the storefront:

| Surface | What you see |
|---------|----------------|
| **Search → Query preview** | Preview mode selector, explanation chips, semantic recovery indicator |
| **Products / Search results** | Score breakdown drawer: lexical, semantic, personalization, applied rules |
| **Experiments** | Candidate-arm AI config summary on each experiment |

**Explanation codes** include: *Lexical match*, *Semantic match*, *Brand affinity*, *Category affinity*, *Product affinity*, *Merchandising rule*, *Semantic recovery*, and *Personalization rerank*.

### Staging vs live and governance

AI ranking configuration is stored in the search API and can be overridden per **experiment candidate arm**. Changes saved on the AI Search page write an **audit log** entry (`update_ai_ranking_config`).

For production rollout:

1. Test in **Search query preview** (all preview modes)
2. Run an **experiment** with candidate AI overrides against a query set
3. Enable hybrid search in staging, then promote via your normal snapshot / approval workflow when satisfied
4. Monitor zero-result rate, CTR, and embedding job health after go-live

Environment variables on Railway can set safe defaults before enabling features in the admin UI (see [Production deployment](#18-production-deployment-railway)).

### Operator reference

Technical architecture, schema, API endpoints, and rollout details are documented in the repository root file `AI_PERSONALIZATION_VECTOR_SEARCH_PLAN.md`. REST API reference: [DEVELOPER_API_GUIDE.md](./DEVELOPER_API_GUIDE.md).

---

## 15. Common workflows

### Fix a zero-result query

1. **Search** workspace or **Zero-results inbox** (`/admin/search/zero-results`) → find the query
2. In the inbox, click **Generate draft** → **Approve** → **Apply to staging**  
   *Or* open a **suggestion** / **query preview** and fix manually
3. If products exist but use different vocabulary → enable or tune **hybrid / semantic search** on **AI Search**, or add a **synonym**
4. If it is a vocabulary gap with no catalog coverage → improve catalog data or add a **synonym**
5. If products exist but rank poorly → create a **boost** or **pin** rule in **Merchandising**
6. **Preview** the query in Products or Search (try **Semantic rescue** mode if lexical hits are zero)
7. **Snapshot** → **request approval** → **promote** (or **schedule** via guided promotion)

### Schedule a promotion for a future launch

1. **Merchandising** → **Guided promotion** (`/admin/merchandising/workflows/new-promotion`)
2. Complete campaign details and select the snapshot
3. On **Launch timing and mode**, choose **Schedule for later** and pick date/time
4. Choose **Request approval** or **Direct promote** (policy enforced when the job runs)
5. Click **Schedule promotion**
6. Monitor pending jobs on **Promotions** (`/admin/merchandising/promotions`) — cancel if plans change

### Test hybrid / AI ranking in an experiment

1. Ensure embedding coverage is sufficient on **AI Search** (run reindex if needed)
2. Create **baseline** and **candidate** snapshots in Merchandising (optional if testing AI-only changes)
3. Create a **query set** with representative shopper queries
4. **Experiments** → create experiment → enable **Candidate AI ranking overrides** (semantic, personalization, weight preset)
5. **Run experiment** and compare baseline vs candidate in the run view / scorecard
6. If results look good, enable hybrid search on **AI Search** or promote via your release workflow

### Test LLM search changes in an experiment

1. Create **baseline** and **candidate** snapshots in Merchandising
2. Create a **query set** with representative shopper queries
3. **Experiments** → create experiment, enable **Candidate LLM overrides** as needed
4. **Run experiment** and review the scorecard / run view
5. If results look good, promote the candidate snapshot (immediate or scheduled)

### Roll out hybrid search safely

1. **AI Search** → set provider to `mock` or your production embeddings provider
2. Run **Reindex all products** and wait for job completion
3. Leave **Hybrid search enabled** off; use **Search → Query preview** in **Lexical only** mode to confirm baseline parity
4. Enable **Semantic retrieval** only; preview in **Hybrid** mode
5. Enable **Personalization**; preview in **Hybrid + personalization** with a test session ID from storefront cookies
6. Run an **experiment** with candidate AI overrides before enabling on live traffic
7. Enable hybrid search for production; monitor zero-results inbox and dashboard CTR

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

## 16. Demo data and sample queries

The demo environment includes **two synthetic catalogs**:

| Catalog ID | Storefront | Products | Vertical |
|------------|------------|----------|----------|
| `default` | BuildMart (port 3000) | ~50,000 | Home improvement |
| `luxury-clothing` | Luxe Atelier (port 3002) | 6,000 | Luxury fashion |

Seed commands:

```bash
pnpm prisma:seed          # BuildMart + demo users + home-improvement rules
pnpm prisma:seed:luxury   # Luxury catalog only (does not wipe default catalog)
```

Merchandising rules and synonyms from both seeds are **merged** into staging/live configuration. Luxury rules reference `lux-prod-*` product IDs; BuildMart rules reference `prod-*` IDs—each storefront’s queries naturally match the relevant rule set.

### BuildMart queries worth trying

Open **http://localhost:3000** and try:

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

### Luxe Atelier queries worth trying

Open **http://localhost:3002** (after `pnpm prisma:seed:luxury`) and try:

| Query | Expected behavior |
|-------|-------------------|
| `silk dress` | Gucci signature silk dress pinned (`lux-prod-hero-001`) |
| `handbag` | Hermès top-handle bag pinned; out-of-stock handbags buried |
| `purse` | Synonym maps to handbag; Saint Laurent clutch pinned |
| `cashmere coat` | Max Mara wrap coat pinned |
| `evening gown` | Valentino couture gown pinned |
| `luxury watch` | Cartier Swiss watch pinned |
| `cashmere sweater` | The Row cashmere crew pinned |
| `trench coat` | Burberry outerwear boosted for women’s coats |
| `designer jeans` | Saint Laurent denim boosted |
| `gold necklace` | Cartier jewelry boosted |

Luxury synonym examples: `handbag` ↔ `purse`, `sneakers` ↔ `trainers`, `evening gown` ↔ `formal dress`.

### Validate catalog isolation

| Action | BuildMart (3000) | Luxe Atelier (3002) |
|--------|------------------|---------------------|
| Search `cordless drill` | Power-tool results | No home-improvement products |
| Search `handbag` | Unrelated or empty | Luxury handbags and heroes |
| Browse categories | Power Tools, Lawn & Garden, … | Women, Men, Accessories |

The same search API serves both storefronts; isolation comes from the catalog ID on each request.

### Queries that exercise semantic search

When hybrid search and embeddings are enabled, these queries help validate semantic retrieval (similar meaning, not exact keywords):

| Query | Why it is useful |
|-------|------------------|
| `tool for driving screws` | May match drills/drivers without the word “drill” |
| `yard cleanup blower` | Semantic overlap with leaf blowers / outdoor power |
| `waterproof outdoor receptacle` | Related to GFCI / exterior electrical products |
| `garage overhead lighting` | Related to shop lights and fixtures |

Compare **Lexical only** vs **Hybrid** preview modes in the Search workspace to see score and ranking differences.

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

## 17. Tips and troubleshooting

### Metrics show zero searches

Run queries on the **storefront** first. Search and click events are stored in the database; dashboards update as traffic accumulates. A fresh deploy with no storefront traffic will show zeros until shoppers (or demo searches) run queries.

### Browse page shows an API error

Confirm the search API is running and reachable at `NEXT_PUBLIC_SEARCH_API_URL`. Browse requires the same connectivity as search (`/api/v1/browse` and `/api/v1/browse/categories`). If `SEARCH_API_KEY_REQUIRED=true`, the storefront must send a valid API key (configure at the platform layer—keys are managed under **Integrations → API keys**).

### Storefront shows the wrong products (multi-catalog)

- Confirm you opened the intended storefront (BuildMart **3000** vs Luxe Atelier **3002**)
- Each storefront sets `NEXT_PUBLIC_CATALOG_ID` (`default` vs `luxury-clothing`); redeploy if you changed it
- Restart search-api after running `pnpm prisma:seed:luxury` so the in-memory catalog reloads
- In browser devtools **Network**, confirm storefront requests include `x-catalog-id: luxury-clothing` (or `default`) on `/search-api/api/v1/search` and browse calls

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

### Cannot access API keys, Platform, or Developer portal

These sidebar items require specific workspace roles (or sign in with a matching standing role):

| Page | Workspace roles that see it |
|------|----------------------------|
| **Integrations → API keys** | Admin only |
| **Integrations → API usage** | Admin, Developer |
| **Developer portal** | Admin, Developer |
| **Platform → Catalogs / Plugins** | Admin only |

**Settings** is visible to all workspace roles. If a mutation fails with HTTP 403, sign out and back in to refresh your CSRF token, or use an account whose standing role matches the action (see [Roles and navigation](#2-roles-and-navigation)).

### Sign-in says “setup required”

Complete the setup wizard (`/setup`) or ask your platform team to run the demo seed for a pre-configured instance.

### Rate limiting (HTTP 429)

The API limits login attempts and admin mutations. Wait for the reset time shown in response headers (`x-ratelimit-reset`).

### Session expired

Sign out and sign in again at `/login`. Default session length is 24 hours.

### Hybrid search preview shows no semantic scores

1. Open **AI Search** and confirm **Hybrid search enabled** and **Semantic retrieval enabled** are checked
2. Check **Coverage** — if embedded products is 0, run **Reindex all products**
3. For real semantics (not mock), set `EMBEDDINGS_PROVIDER=openai` or `openrouter` and `EMBEDDINGS_API_KEY` on search-api, then reindex
4. Restart search-api after env changes so the vector index reloads

### Embedding reindex job failed

- Confirm `DATABASE_URL` is connected (`/health` on search-api)
- Check provider credentials and model name on **AI Search**
- Retry reindex; failed jobs are logged in **Recent embedding jobs**
- For large catalogs, increase patience or reduce `EMBEDDING_BATCH_SIZE` if the provider rate-limits

### Personalization preview has no effect

- Enter a valid **session ID** in query preview (copy from storefront session cookie)
- Run several storefront searches and product clicks in that browser session first
- Confirm **Personalization enabled** on **AI Search** and use **Hybrid + personalization** preview mode

### Semantic recovery not triggering

- Use **Semantic rescue** preview mode or a query with very few lexical hits
- Lower **Semantic fallback min hits** on **AI Search** if testing edge cases
- Ensure **Semantic zero-results fallback** is enabled

---

## 18. Production deployment (Railway)

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
| `HYBRID_SEARCH_ENABLED` | Enable hybrid lexical + semantic + personalization pipeline (`true` / `false`) |
| `SEMANTIC_SEARCH_ENABLED` | Enable semantic vector retrieval (`true` / `false`) |
| `PERSONALIZATION_ENABLED` | Enable session personalization boosts (`true` / `false`) |
| `SEMANTIC_ZERO_RESULTS_FALLBACK_ENABLED` | Enable semantic rescue for low-hit queries |
| `SEMANTIC_FALLBACK_MIN_HITS` | Lexical hit threshold before semantic rescue (default 3) |
| `EMBEDDINGS_PROVIDER` | `mock`, `openai`, or `openrouter` |
| `EMBEDDINGS_MODEL` | Embeddings model name (e.g. `text-embedding-3-small`) |
| `EMBEDDINGS_API_KEY` | Provider API key when not using `mock` |
| `EMBEDDINGS_BASE_URL` | Optional OpenAI-compatible base URL override |
| `EMBEDDING_DIMENSIONS` | Vector dimensions (default 64 for mock) |
| `EMBEDDING_BATCH_SIZE` | Products per embedding batch during reindex (default 32) |
| `PRODUCT_EMBEDDINGS_ENABLED` | Persist product embeddings (`true` / `false`) |
| `LEXICAL_WEIGHT` / `SEMANTIC_WEIGHT` / `PERSONALIZATION_WEIGHT` | Default ranking weights (e.g. 0.55 / 0.30 / 0.15) |
| `PERSONALIZATION_LOOKBACK_DAYS` | Session profile window (default 30) |
| `PERSONALIZATION_DECAY_HALF_LIFE_DAYS` | Recency decay for affinities (default 14) |
| `HYBRID_VECTOR_ENABLED` | Legacy alias; still enables hybrid defaults if set |

**Verify:** `GET /health` returns `"ok": true`, `"database.connected": true`, and `"productCount" > 0` after migrate/seed. After enabling hybrid search, run an embedding reindex from ForgeOps **AI Search** before expecting semantic quality in production.

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

**Verify:** Open the BuildMart storefront URL and run `cordless drill`. Optionally deploy **Luxe Atelier** as a second service with `NEXT_PUBLIC_CATALOG_ID=luxury-clothing` and verify `silk dress` on port 3002 locally.

### Optional: Luxe Atelier storefront service

For a second production storefront (luxury catalog), add another Railway service:

| Setting | Value |
|---------|--------|
| Config file | `apps/storefront-luxury/railway.toml` |
| Start command | `pnpm --filter @retailer-search/storefront-luxury start` |
| `NEXT_PUBLIC_CATALOG_ID` | `luxury-clothing` |
| `NEXT_PUBLIC_SEARCH_API_URL` | Same search-api domain as BuildMart |

Run `pnpm prisma:seed:luxury` against the shared database before expecting luxury products.

### Database seed (demo data)

From a machine with repo access and `DATABASE_URL` pointing at Railway Postgres:

```bash
cd services/search-api
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
```

This loads ~50,000 demo products and the demo user accounts listed in [Demo environment](#demo-environment-pre-seeded). Seeding marks setup as complete so `/setup` is skipped.

Add the luxury catalog (additive):

```bash
pnpm prisma:seed:luxury
```

This inserts 6,000 luxury products under catalog `luxury-clothing` and merges luxury merchandising rules and synonyms into the shared configuration.

`prisma migrate deploy` also applies AI hybrid search schema changes (`ProductEmbedding`, `EmbeddingJob`, experiment AI config fields). Run an embedding reindex from **AI Search** after seeding if you plan to test semantic retrieval.

### Operator checklist after deploy

- [ ] Search API `/health` shows database connected and products loaded
- [ ] Admin `/health` returns OK
- [ ] Admin `SEARCH_API_URL` points at the search-api public URL
- [ ] Storefront `NEXT_PUBLIC_SEARCH_API_URL` matches the search-api public URL
- [ ] Generate public domains for all three services in Railway **Networking**
- [ ] (Optional) Configure LLM provider env vars if using query rewrite, zero-results recovery, or rerank in production
- [ ] (Optional) Run `pnpm prisma:seed:luxury` and verify Luxe Atelier storefront on port 3002
- [ ] (Optional) Configure AI / hybrid search env vars and run embedding reindex from **AI Search** before enabling semantic retrieval
- [ ] (Optional) Create API keys under ForgeOps **Integrations → API keys** and set `SEARCH_API_KEY_REQUIRED=true` if partners must authenticate

---

## 19. Multi-catalog platform

**Path:** `/admin/platform/catalogs` *(Admin)*

The platform supports **multiple product catalogs per tenant**. Each catalog has its own product rows in the database; search, browse, and autocomplete filter by catalog ID. Merchandising rules and synonyms are shared at the environment level (staging/live), but demo rules are authored with catalog-specific product IDs so each vertical behaves correctly.

### Catalog registry

On **Platform → Catalogs** you can:

- View registered catalogs with product counts
- Create new catalogs (name, slug, tenant ID, default flag)
- Activate or deactivate catalogs

After seeding, you should see at least:

| Catalog ID | Name | Products (approx.) |
|------------|------|---------------------|
| `default` | Default catalog | ~50,000 |
| `luxury-clothing` | Luxe Atelier Collection | 6,000 |

### Catalog switcher (admin header)

When multiple catalogs exist, a **catalog switcher** appears in the ForgeOps header. It scopes admin previews and vocabulary autocomplete to the selected catalog context where applicable.

### How storefronts bind to catalogs

Each storefront app sets a catalog ID via environment variable:

| Variable | BuildMart | Luxe Atelier |
|----------|-----------|--------------|
| `NEXT_PUBLIC_CATALOG_ID` | `default` (or unset) | `luxury-clothing` |

The storefront proxy and server components send `X-Catalog-Id` on all search API calls. Integrators can also pass `catalogId` as a query parameter on `/api/v1/search` (see [DEVELOPER_API_GUIDE.md](./DEVELOPER_API_GUIDE.md)).

### Merchandising rules across catalogs

Rules are **global per environment** (staging/live), not stored per catalog. In the demo seed:

- BuildMart rules target `prod-*` heroes and home-improvement synonyms
- Luxury rules (from `pnpm prisma:seed:luxury`) target `lux-prod-*` heroes and fashion synonyms

Both sets coexist in the same rule list. A query like `handbag` matches luxury pin rules; `cordless drill` matches BuildMart rules. When authoring production rules, use product IDs from the catalog your storefront serves.

### Embedding reindex with multiple catalogs

**AI Search → Reindex** processes products across the database. After adding a second catalog, run reindex so semantic search covers luxury SKUs as well as the default catalog (required before hybrid preview works well on Luxe Atelier queries).

### Operator workflow: add a second retailer

1. **Platform → Catalogs** → create catalog (or run a dedicated seed script)
2. Deploy a storefront (or mobile app) with `NEXT_PUBLIC_CATALOG_ID` set to the new catalog ID
3. Issue an API key scoped for search/browse if `SEARCH_API_KEY_REQUIRED=true`
4. Author merchandising rules referencing that catalog’s product IDs
5. Promote staging → live through the normal approval workflow

---

## Quick reference — admin routes

| Route | Purpose |
|-------|---------|
| `/admin` | Dashboard |
| `/admin/products` | Catalog search preview and insights |
| `/admin/search` | Analytics, suggestions, query preview (incl. AI modes), zero-results panel |
| `/admin/ai-search` | Hybrid ranking settings, embedding coverage, reindex jobs |
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
| `/admin/platform/catalogs` | Multi-catalog registry |
| `/login` | Sign in |
| `/setup` | First-run instance setup |
| `/health` | Admin service health (production ops) |

**Storefront routes (BuildMart — port 3000):**

| Route | Purpose |
|-------|---------|
| `/` | Shopper search (catalog: `default`) |
| `/browse` | Category browse, filters, sort, pagination |

**Storefront routes (Luxe Atelier — port 3002):**

| Route | Purpose |
|-------|---------|
| `/` | Luxury shopper search (catalog: `luxury-clothing`) |
| `/browse` | Women / Men / Accessories browse |

**Search API (backend):** `/health` — JSON status and catalog counts. Public routes include `/api/v1/search`, `/api/v1/browse`, `/api/v1/browse/categories`, and event ingestion under `/api/v1/events/*`. Pass `X-Catalog-Id` or `catalogId` to scope search to a catalog.

---

*ForgeOps — operations, merchandising, and governance for multi-catalog retail search.*
