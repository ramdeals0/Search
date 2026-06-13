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

---

## 1. Getting started

### What you need

- A running local or deployed instance of the platform
- A web browser (Chrome, Edge, Firefox, or Safari)

### Default URLs (local development)

| Application | URL |
|-------------|-----|
| Storefront (shopper search) | http://localhost:3000 |
| ForgeOps admin | http://localhost:3001 |
| Search API (backend) | http://localhost:4001 |

### First-time setup (fresh instance)

If the database has never been configured:

1. Open **http://localhost:3001/setup**
2. Complete the setup wizard in order:
   - **Welcome** — overview of the instance
   - **Create admin account** — first administrator user
   - **Security defaults** — session and policy basics
   - **Platform defaults** — environment labels and defaults
   - **Review and complete** — confirm and finish
3. Sign in at **http://localhost:3001/login**

Until setup completes, admin features return a “setup required” message. Public search and setup endpoints remain available.

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

1. Go to **http://localhost:3001/login**
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
| **Catalog** | Products, Search, Merchandising, Experiments |
| **Governance** | Approvals, Access, Audit, Notifications |
| **Operations** | Exports, Integrations, Settings |

Pages hidden for your role will not appear in the sidebar.

### Staging vs live

Search merchandising configuration exists in two environments:

- **Staging** — where you draft and test rule changes
- **Live** — what shoppers see on the storefront

Most rule editing happens in **staging**. Changes reach **live** through snapshots, approvals, and promotion (see [Approvals and release workflow](#9-approvals-and-release-workflow)).

Use the **environment switcher** on the Dashboard or Settings page to see which environment you are viewing.

---

## 3. Customer storefront

The storefront is the shopper-facing search experience at **http://localhost:3000**.

### Searching for products

1. Type a query in the search bar (e.g. `cordless drill`, `mulch`, `gfci outlet`)
2. Press **Enter** or select a suggestion from autocomplete
3. Browse results on the right; use **filters** on the left

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

Every storefront search and product click is recorded. This data powers admin analytics, suggestions, and the **Products** insight panels. Run realistic searches during demos to populate dashboards.

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

---

## 8. Experiments workspace

**Path:** `/admin/experiments`

Test search changes scientifically before wide release.

### Query set editor

Define a set of queries to evaluate consistently (e.g. hero queries like `cordless drill`, `shop vac`).

### Experiments panel

Create and manage A/B-style search experiments comparing configurations.

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

1. **Search** workspace → find the query in zero-result list
2. Open the **suggestion** or **query preview**
3. If it is a vocabulary gap → add a **synonym** or improve catalog coverage
4. If products exist but rank poorly → create a **boost** or **pin** rule in **Merchandising**
5. **Preview** the query in Products or Search
6. **Snapshot** → **request approval** → **promote**

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

Run queries on the **storefront** first. Analytics are in-memory until the API restarts—searches and clicks accumulate during the session.

### Rule change not visible on storefront

- Confirm the rule is **Active**
- Rules edit in **staging**—promote to **live** for shopper impact
- Restart is not required; promotion updates live immediately

### Brand or category not clearing on save

Clear the field completely and save. Empty condition fields are removed on save (not merged with previous values).

### Autocomplete empty in rule form

The catalog vocabulary loads from the API on page open. Confirm the search API is running at http://localhost:4001.

### Cannot access Settings or Integrations

These pages require **Admin** workspace role (or an admin account with JIT elevation).

### Sign-in says “setup required”

Complete **http://localhost:3001/setup** or run the demo seed for a pre-configured instance.

### Rate limiting (HTTP 429)

The API limits login attempts and admin mutations. Wait for the reset time shown in response headers (`x-ratelimit-reset`).

### Session expired

Sign out and sign in again at `/login`. Default session length is 24 hours.

---

## Quick reference — admin routes

| Route | Purpose |
|-------|---------|
| `/admin` | Dashboard |
| `/admin/products` | Catalog search preview and insights |
| `/admin/search` | Analytics, suggestions, query preview |
| `/admin/merchandising` | Rules, snapshots, environments, promotion |
| `/admin/experiments` | Query sets, experiments, scorecards |
| `/admin/approvals` | Approval queue, SLA, exceptions, delegation |
| `/admin/access` | JIT access, role requests, access reviews |
| `/admin/audit` | Audit log and security timeline |
| `/admin/notifications` | Notification inbox |
| `/admin/exports` | Export jobs |
| `/admin/integrations` | Webhooks |
| `/admin/settings` | Environment and policy defaults |
| `/login` | Sign in |
| `/setup` | First-run instance setup |

---

*ForgeOps — operations, merchandising, and governance for home-improvement commerce catalogs.*
