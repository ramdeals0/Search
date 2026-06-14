# Developer API Guide

REST API reference for the **Retailer Search Platform** (`search-api` service). Use this guide to integrate storefronts, mobile apps, partner systems, and custom tooling against search, browse, analytics events, and ForgeOps admin endpoints.

For operator workflows and UI documentation, see [USER_GUIDE.md](./USER_GUIDE.md). For AI hybrid search architecture and rollout, see [AI_PERSONALIZATION_VECTOR_SEARCH_PLAN.md](../AI_PERSONALIZATION_VECTOR_SEARCH_PLAN.md).

---

## Table of contents

1. [Overview](#1-overview)
2. [Authentication](#2-authentication)
3. [Request conventions](#3-request-conventions)
4. [Errors and rate limits](#4-errors-and-rate-limits)
5. [TypeScript types](#5-typescript-types)
6. [Public integrator APIs](#6-public-integrator-apis)
7. [Hybrid search response fields](#7-hybrid-search-response-fields)
8. [Analytics and commerce events](#8-analytics-and-commerce-events)
9. [Discovery and branding](#9-discovery-and-branding)
10. [Session auth (ForgeOps)](#10-session-auth-forgeops)
11. [Admin API reference](#11-admin-api-reference)
12. [AI Search admin APIs](#12-ai-search-admin-apis)
13. [Developer API keys](#13-developer-api-keys)
14. [Webhooks](#14-webhooks)
15. [Plugin SDK](#15-plugin-sdk)
16. [Examples](#16-examples)
17. [Environment variables](#17-environment-variables)

---

## 1. Overview


| Item               | Value                                                                            |
| ------------------ | -------------------------------------------------------------------------------- |
| **Service**        | `search-api`                                                                     |
| **Local base URL** | `http://localhost:4001`                                                          |
| **API prefix**     | `/api/v1`                                                                        |
| **Health**         | `GET /health` (no auth)                                                          |
| **Metrics**        | `GET /metrics` (Prometheus text), `GET /api/v1/internal/metrics` (JSON snapshot) |
| **Content type**   | JSON request/response (`application/json`)                                       |
| **CORS**           | `Access-Control-Allow-Origin: `* on all routes                                   |


All versioned routes live under `/api/v1`. Admin routes are under `/api/v1/admin/*`.

---

## 2. Authentication

The API supports **two authentication modes**:

### API keys (integrator / storefront)

Used for public search, browse, and event ingestion when `SEARCH_API_KEY_REQUIRED=true` (recommended in production).


| Header          | Example                      |
| --------------- | ---------------------------- |
| `X-API-Key`     | `rsp_a1b2c3d4e5f6...`        |
| `Authorization` | `Bearer rsp_a1b2c3d4e5f6...` |


**Default scopes** on new keys:


| Scope          | Routes                                                |
| -------------- | ----------------------------------------------------- |
| `search:read`  | `GET /api/v1/search`, `GET /api/v1/autocomplete`      |
| `browse:read`  | `GET /api/v1/browse`, `GET /api/v1/browse/categories` |
| `events:write` | `POST /api/v1/events/`*                               |


When `SEARCH_API_KEY_REQUIRED` is not `true`, these routes are open without a key (development default).

### Session bearer token (ForgeOps admin)

Admin and authenticated routes expect a user session from login:

```http
Authorization: Bearer <session-token>
```

Obtain the token via `POST /api/v1/auth/login`. Session TTL defaults to 24 hours (`SESSION_TTL_HOURS`).

Some admin mutations additionally require the `**admin**` user role (for example `PATCH /api/v1/admin/ai-search/config`).

---

## 3. Request conventions

### Recommended headers


| Header                                       | Purpose                                                           |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `Content-Type: application/json`             | Required on POST/PUT/PATCH bodies                                 |
| `X-Request-Id`                               | Optional correlation ID; echoed as `x-request-id` on the response |
| `X-Session-Id`                               | Shopper session for personalization and analytics attribution     |
| `X-Catalog-Id`                               | Multi-catalog filter (P4); falls back to tenant default           |
| `X-API-Key` or `Authorization: Bearer <key>` | Integrator authentication                                         |


### Query parameters

- Repeatable filters: pass multiple values (`?brand=DeWalt&brand=Milwaukee`) or array form depending on client.
- Pagination: `page` (1-based), `pageSize` (max 100 on search/browse).
- Search debug: `debug=true` includes per-hit `rankingDebug` and response-level `aiRankingDebug`.

### Multi-catalog

Pass `catalogId` query param or `X-Catalog-Id` header on search to scope results to a catalog registered in ForgeOps.

---

## 4. Errors and rate limits

### Error envelope

Most structured errors use:

```json
{
  "success": false,
  "code": "validation_error",
  "message": "Invalid query parameters",
  "details": {},
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Codes:** `unauthenticated`, `forbidden`, `validation_error`, `not_found`, `conflict`, `rate_limited`, `internal_error`

Legacy endpoints may return `{ "error": "..." }` or `{ "code": "API_KEY_REQUIRED" }` for key enforcement.

### Rate limit headers

When rate limiting applies:


| Header                  | Description                      |
| ----------------------- | -------------------------------- |
| `x-ratelimit-limit`     | Max requests in window           |
| `x-ratelimit-remaining` | Remaining requests               |
| `x-ratelimit-reset`     | ISO timestamp when window resets |


**Policies:**


| Traffic           | Default limit                 | Window |
| ----------------- | ----------------------------- | ------ |
| API key per route | 120/min (or per-key override) | 60s    |
| Admin read        | 300                           | 60s    |
| Admin mutation    | 60                            | 60s    |
| Auth login        | 5 per email + IP              | 300s   |


HTTP **429** when exceeded.

---

## 5. TypeScript types

Install or import from the monorepo package:

```bash
pnpm add @retailer-search/shared-types
```

Key DTOs:


| Type                                                     | Use             |
| -------------------------------------------------------- | --------------- |
| `SearchRequestDto`, `SearchResponseDto`, `SearchHitDto`  | Search          |
| `AutocompleteResponseDto`                                | Autocomplete    |
| `BrowseResponseDto`, `BrowseCategoryDto`                 | Browse          |
| `SearchEventDto`, `SearchClickEventDto`                  | Events          |
| `RecordCommerceEventRequestDto`                          | Commerce events |
| `AiRankingConfigDto`, `AiQueryPreviewResponseDto`        | AI admin        |
| `ExperimentArmAiConfigDto`, `CreateExperimentRequestDto` | Experiments     |
| `ApiErrorResponseDto`, `HealthResponseDto`               | Cross-cutting   |


Source: `packages/shared-types/src/`.

---

## 6. Public integrator APIs

### `GET /api/v1/search`

Keyword + hybrid ranking (when enabled), merchandising rules, facets, optional content modules.

**Auth:** `search:read` (when keys required)

**Query parameters:**


| Param       | Type     | Default   | Description                             |
| ----------- | -------- | --------- | --------------------------------------- |
| `query`     | string   | `""`      | Search text                             |
| `page`      | int      | `1`       | Page number                             |
| `pageSize`  | int      | `20`      | Page size (max 100)                     |
| `brand`     | string[] | —         | Facet filter                            |
| `category`  | string[] | —         | Facet filter                            |
| `inStock`   | string[] | —         | `"true"` / `"false"`                    |
| `indexes`   | string   | `catalog` | Federated index names (comma-separated) |
| `catalogId` | string   | —         | Catalog scope                           |
| `debug`     | boolean  | `false`   | Include ranking debug                   |


**Example:**

```http
GET /api/v1/search?query=cordless+drill&page=1&pageSize=20&debug=true
X-API-Key: rsp_your_key_here
X-Session-Id: shopper-session-abc123
```

**Response:** `SearchResponseDto`

```json
{
  "query": "cordless drill",
  "correctedQuery": "cordless drill",
  "page": 1,
  "pageSize": 20,
  "totalHits": 142,
  "totalPages": 8,
  "processingTimeMs": 12,
  "hits": [
    {
      "id": "prod-00185",
      "sku": "SKU-00185",
      "title": "20V Max Cordless Drill Kit",
      "brand": "DeWalt",
      "category": "Power Tools",
      "subcategory": "Drills",
      "description": "...",
      "price": 129.99,
      "inStock": true,
      "score": 0.87,
      "rankingDebug": {
        "productId": "prod-00185",
        "lexicalScore": 0.72,
        "semanticScore": 0.81,
        "personalizationScore": 0.05,
        "finalScore": 0.87,
        "appliedRuleNames": ["Hero drill pin"],
        "explanationCodes": ["lexical_match", "semantic_match", "merchandising_rule_applied"]
      }
    }
  ],
  "availableFacets": {
    "brand": [{ "value": "DeWalt", "count": 24 }],
    "category": [{ "value": "Power Tools", "count": 142 }],
    "inStock": [{ "value": "true", "count": 130 }]
  },
  "appliedRuleNames": ["Hero drill pin"],
  "rankingMode": "hybrid",
  "aiRankingDebug": {
    "rankingMode": "live",
    "lexicalWeight": 0.55,
    "semanticWeight": 0.3,
    "personalizationWeight": 0.15,
    "semanticHits": 48,
    "semanticRecoveryApplied": false,
    "embeddingProvider": "mock",
    "embeddingModel": "mock-hash-v1"
  },
  "experimentArm": "baseline"
}
```

`rankingDebug` and `aiRankingDebug` appear when `debug=true` or in admin preview contexts.

---

### `GET /api/v1/autocomplete`

Typeahead suggestions for queries, brands, categories, and products.

**Auth:** `search:read`

**Query:** `query` (string)

**Response:** `AutocompleteResponseDto`

```json
{
  "query": "dri",
  "normalizedQuery": "dri",
  "correctedQuery": "drill",
  "suggestions": [
    { "value": "drill", "type": "query" },
    { "value": "DeWalt", "type": "brand" },
    { "value": "20V Max Cordless Drill Kit", "type": "product" }
  ]
}
```

---

### `GET /api/v1/browse`

Category browse with filters and sort (no query string required).

**Auth:** `browse:read`

**Query parameters:**


| Param              | Values                                              |
| ------------------ | --------------------------------------------------- |
| `category`         | Category name                                       |
| `brand`            | Brand name                                          |
| `inStock`          | `true` / `false`                                    |
| `sort`             | `relevance`, `price_asc`, `price_desc`, `title_asc` |
| `page`, `pageSize` | Pagination                                          |


**Response:** `BrowseResponseDto` — `totalHits`, `hits[]`, optional `categories[]`.

---

### `GET /api/v1/browse/categories`

Returns category tree with product counts for browse navigation.

**Auth:** `browse:read`

---

## 7. Hybrid search response fields

When `HYBRID_SEARCH_ENABLED=true` (or enabled via ForgeOps AI config), search uses lexical + semantic + optional personalization. Lexical retrieval is **never removed**.


| Field                               | Location      | Description                                                        |
| ----------------------------------- | ------------- | ------------------------------------------------------------------ |
| `rankingMode`                       | Response root | e.g. `hybrid`, `lexical`, `live`                                   |
| `aiRankingDebug`                    | Response root | Pipeline weights, semantic hit count, recovery flag                |
| `rankingDebug.lexicalScore`         | Per hit       | Normalized keyword score                                           |
| `rankingDebug.semanticScore`        | Per hit       | Vector similarity score                                            |
| `rankingDebug.personalizationScore` | Per hit       | Session affinity contribution                                      |
| `rankingDebug.explanationCodes`     | Per hit       | Reason codes (see below)                                           |
| `experimentArm`                     | Response root | `baseline` or `candidate` when an online experiment assigns an arm |


**Explanation codes:** `lexical_match`, `semantic_match`, `user_brand_affinity`, `user_category_affinity`, `user_product_affinity`, `merchandising_rule_applied`, `zero_results_semantic_recovery`, `personalization_rerank`

**Personalization:** Send a stable `X-Session-Id` per shopper browser session. The API records query affinity on search and updates profiles on clicks (`/events/click`) and commerce events.

---

## 8. Analytics and commerce events

### `POST /api/v1/events/search`

Record a search impression (optional if you rely on server-side logging from `GET /search`).

**Auth:** `events:write`

```json
{
  "query": "cordless drill",
  "resultCount": 142
}
```

**Response:** `201` + `SearchEventDto`

Also updates personalization profile when `X-Session-Id` is present.

---

### `POST /api/v1/events/click`

Record a product click from search results.

**Auth:** `events:write`

```json
{
  "query": "cordless drill",
  "productId": "prod-00185",
  "productTitle": "20V Max Cordless Drill Kit"
}
```

**Response:** `201` + `SearchClickEventDto`

Updates session personalization affinities when `X-Session-Id` is present.

---

### `POST /api/v1/events/commerce`

Record add-to-cart or purchase signals for analytics and personalization.

**Auth:** `events:write`

```json
{
  "type": "add_to_cart",
  "query": "cordless drill",
  "productId": "prod-00185",
  "amountCents": 12999
}
```

`type`: `add_to_cart` | `purchase`

**Response:** `201` + `{ "success": true }`

---

## 9. Discovery and branding

### `GET /api/v1/discovery/trending`

**Query:** `limit` (default 10), `days` (default 7)

Returns trending queries from analytics.

### `GET /api/v1/discovery/recent`

**Query:** `limit` (default 10)  
**Required header:** `X-Session-Id`

Returns recent queries for the session.

### `GET /api/v1/branding`

Public tenant branding (logo, colors, display name). No auth required.

---

## 10. Session auth (ForgeOps)

### `POST /api/v1/auth/login`

```json
{
  "email": "admin@example.com",
  "password": "demo123"
}
```

**Response (success):**

```json
{
  "success": true,
  "session": {
    "token": "sess_...",
    "user": { "id": "...", "email": "...", "role": "admin" },
    "createdAt": "2026-06-10T12:00:00.000Z",
    "expiresAt": "2026-06-11T12:00:00.000Z"
  }
}
```

Use `Authorization: Bearer <session.token>` on subsequent admin requests.

### `GET /api/v1/auth/me`

Returns `CurrentUserResponseDto` — authenticated user, effective role, permissions.

### `POST /api/v1/auth/logout`

Invalidates the session token sent in `Authorization`.

---

## 11. Admin API reference

All routes below require `Authorization: Bearer <session>` unless noted. Most live under `/api/v1/admin/*` and inherit admin rate limits.

### Merchandising and configuration


| Method   | Path                          | Description                      |
| -------- | ----------------------------- | -------------------------------- |
| GET      | `/admin/rules`                | List staging merchandising rules |
| GET      | `/admin/rules/:id`            | Get rule                         |
| POST     | `/admin/rules`                | Create rule                      |
| PUT      | `/admin/rules/:id`            | Update rule                      |
| DELETE   | `/admin/rules/:id`            | Delete rule                      |
| GET      | `/admin/snapshots`            | List snapshots                   |
| POST     | `/admin/snapshots`            | Create snapshot                  |
| GET      | `/admin/snapshots/diff`       | Compare snapshots                |
| POST     | `/admin/snapshots/rollback`   | Rollback staging                 |
| GET      | `/admin/active-configuration` | Live config summary              |
| GET/POST | `/admin/environments/copy`    | Copy live → staging              |
| POST     | `/admin/environments/promote` | Promote staging → live           |
| POST     | `/admin/promote-snapshot`     | Promote snapshot to live         |


**Create rule body:**

```json
{
  "name": "Boost mulch season",
  "active": true,
  "priority": 60,
  "action": "boost",
  "condition": { "query": "mulch" },
  "brand": "GreenThumb",
  "boostAmount": 15
}
```

`action`: `pin` | `boost` | `bury` | `hide`

### Search ops and preview


| Method | Path                                | Description                                                 |
| ------ | ----------------------------------- | ----------------------------------------------------------- |
| GET    | `/admin/query-preview`              | Legacy keyword preview (`query`, `pageSize`, `environment`) |
| GET    | `/admin/analytics/summary`          | Search analytics aggregate                                  |
| GET    | `/admin/analytics/catalog-insights` | Top products/brands/queries                                 |
| GET    | `/admin/suggestions`                | Merchandising suggestions                                   |
| POST   | `/admin/suggestions/apply`          | Apply a suggestion                                          |
| GET    | `/admin/analytics/zero-results`     | Zero-result query inbox                                     |
| POST   | `/admin/search-index/rebuild`       | Rebuild lexical index                                       |


### Experiments


| Method   | Path                                        | Description                   |
| -------- | ------------------------------------------- | ----------------------------- |
| GET/POST | `/admin/query-sets`                         | Evaluation query sets         |
| GET/POST | `/admin/experiments`                        | Create/list experiments       |
| GET      | `/admin/experiments/:id`                    | Detail + last run + scorecard |
| POST     | `/admin/experiments/:id/run`                | Execute experiment            |
| POST     | `/admin/experiments/:id/scorecard/generate` | Regenerate scorecard          |
| POST     | `/admin/experiments/:id/online`             | Toggle online A/B traffic     |


**Create experiment body:**

```json
{
  "name": "Hybrid vs baseline",
  "baselineSnapshotId": "snap-001",
  "candidateSnapshotId": "snap-002",
  "querySetId": "qset-001",
  "candidateLlmOverrides": {
    "queryRewriteEnabled": false,
    "zeroResultsEnabled": false,
    "rerankEnabled": false
  },
  "candidateAiConfig": {
    "semanticRetrievalEnabled": true,
    "personalizationEnabled": true,
    "weights": {
      "lexicalWeight": 0.45,
      "semanticWeight": 0.35,
      "personalizationWeight": 0.2
    }
  }
}
```

### Governance


| Method   | Path                           | Description                |
| -------- | ------------------------------ | -------------------------- |
| GET/POST | `/admin/approvals`             | Approval requests          |
| POST     | `/admin/approvals/:id/resolve` | Approve/reject             |
| POST     | `/admin/approvals/:id/execute` | Execute approved promotion |
| GET      | `/admin/audit-logs`            | Filterable audit trail     |
| GET      | `/admin/notifications`         | In-app notifications       |


### Platform (P4)


| Method    | Path                                     | Description            |
| --------- | ---------------------------------------- | ---------------------- |
| GET/PATCH | `/admin/catalogs`, `/admin/catalogs/:id` | Multi-catalog registry |
| GET/PATCH | `/admin/branding`                        | Tenant branding        |
| GET/PATCH | `/admin/plugins/:id`                     | Search plugins         |
| GET       | `/admin/api-usage`                       | API key usage metrics  |


### Integrations


| Method   | Path                        | Description       |
| -------- | --------------------------- | ----------------- |
| GET/POST | `/admin/webhooks`           | Webhook endpoints |
| POST     | `/admin/webhooks/test-fire` | Test delivery     |
| GET/POST | `/admin/exports`            | Data exports      |


Synonyms, LLM settings, access governance, and collaboration endpoints are also available under `/admin/*` — see route registrations in `services/search-api/src/`.

---

## 12. AI Search admin APIs

Base path: `/api/v1/admin/ai-search/*`  
**Auth:** Session bearer; config mutations require **admin** role.

### `GET /admin/ai-search/config`

Returns `AiRankingConfigDto` — hybrid toggles, weights, embedding provider/model, personalization windows.

### `PATCH /admin/ai-search/config`

Partial update (`UpdateAiRankingConfigRequestDto`). Writes audit entry `update_ai_ranking_config`.

```json
{
  "enabled": true,
  "semanticRetrievalEnabled": true,
  "personalizationEnabled": true,
  "weights": {
    "lexicalWeight": 0.55,
    "semanticWeight": 0.3,
    "personalizationWeight": 0.15
  },
  "embeddingsProvider": "openai",
  "embeddingsModel": "text-embedding-3-small"
}
```

Weights are normalized server-side to sum to 1.

### `GET /admin/ai-search/embedding-coverage`

Returns `EmbeddingCoverageDto`:

```json
{
  "totalProducts": 50000,
  "embeddedProducts": 50000,
  "coveragePercent": 100,
  "model": "mock-hash-v1",
  "provider": "mock"
}
```

### `GET /admin/ai-search/embedding-jobs`

List embedding jobs (`EmbeddingJobListResponseDto`).

### `GET /admin/ai-search/embedding-jobs/:id`

Single job status.

### `POST /admin/ai-search/embedding-jobs`

Trigger indexing. Returns `202` + `EmbeddingJobDto`.

```json
{
  "jobType": "backfill",
  "productIds": ["prod-001", "prod-002"]
}
```

`jobType`: `backfill` | `incremental` | `reindex` (default `backfill`). Omit `productIds` to index the full catalog.

### `GET /admin/ai-search/query-preview`

Admin ranking preview with explicit mode override.

**Query parameters:**


| Param         | Description                                                      |
| ------------- | ---------------------------------------------------------------- |
| `query`       | Required search text                                             |
| `previewMode` | `lexical`, `hybrid`, `hybrid_personalization`, `semantic_rescue` |
| `pageSize`    | Max 50 (default 10)                                              |
| `environment` | `staging` (default) or `live`                                    |
| `sessionId`   | Optional shopper session for personalization preview             |


**Response:** `AiQueryPreviewResponseDto` with per-hit `rankingDebug` and `aiRankingDebug`.

---

## 13. Developer API keys

### Admin-managed keys


| Method | Path                         | Auth          | Description   |
| ------ | ---------------------------- | ------------- | ------------- |
| GET    | `/admin/api-keys`            | Admin session | List all keys |
| POST   | `/admin/api-keys`            | Admin session | Create key    |
| DELETE | `/admin/api-keys/:id`        | Admin session | Revoke key    |
| POST   | `/admin/api-keys/:id/rotate` | Admin session | Rotate key    |


**Create body (`CreateApiKeyRequestDto`):**

```json
{
  "name": "Storefront production",
  "tenantId": "default",
  "scopes": ["search:read", "browse:read", "events:write"],
  "rateLimitPerMinute": 600,
  "expiresAt": "2027-01-01T00:00:00.000Z"
}
```

**Response:** `{ "apiKey": ApiKeyDto, "secret": "rsp_..." }` — **store `secret` immediately**; it is not returned again.

### Developer portal (self-service)

Users with the `developer` role:


| Method | Path                             | Description    |
| ------ | -------------------------------- | -------------- |
| GET    | `/developer/api-keys`            | List own keys  |
| POST   | `/developer/api-keys`            | Create own key |
| DELETE | `/developer/api-keys/:id`        | Revoke own key |
| POST   | `/developer/api-keys/:id/rotate` | Rotate own key |


---

## 14. Webhooks

Configure under `/api/v1/admin/webhooks`. Supported event types include merchandising changes, auth events, and approval lifecycle events.

**Test fire:** `POST /admin/webhooks/test-fire`

```json
{
  "eventType": "search.promoted",
  "payload": { "snapshotId": "snap-001" }
}
```

Deliveries are listed at `GET /admin/webhook-deliveries`.

---

## 15. Plugin SDK

Package: `@retailer-search/plugin-sdk`

Register hooks that run inside the search API process:


| Hook        | When             | Input / output                |
| ----------- | ---------------- | ----------------------------- |
| `preSearch` | Before retrieval | Transform `SearchRequestDto`  |
| `postRank`  | After ranking    | Transform `SearchResponseDto` |


```typescript
import type { SearchPlugin } from "@retailer-search/plugin-sdk";

export const myPlugin: SearchPlugin = {
  id: "acme-boost",
  name: "Acme Boost Plugin",
  version: "1.0.0",
  hooks: {
    postRank: ({ response }) => ({
      response: {
        ...response,
        hits: response.hits.map((hit) =>
          hit.brand === "Acme" ? { ...hit, score: hit.score + 0.1 } : hit,
        ),
      },
    }),
  },
};
```

Enable plugins via `PATCH /api/v1/admin/plugins/:id`.

---

## 16. Examples

### cURL — search with personalization

```bash
curl -s "http://localhost:4001/api/v1/search?query=mulch&pageSize=10" \
  -H "X-API-Key: rsp_your_key" \
  -H "X-Session-Id: demo-session-001" | jq '.totalHits, .rankingMode'
```

### cURL — record click

```bash
curl -s -X POST "http://localhost:4001/api/v1/events/click" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: rsp_your_key" \
  -H "X-Session-Id: demo-session-001" \
  -d '{"query":"mulch","productId":"prod-01234","productTitle":"Premium Mulch 2cu ft"}'
```

### cURL — admin login + AI config

```bash
TOKEN=$(curl -s -X POST "http://localhost:4001/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"demo123"}' | jq -r '.session.token')

curl -s "http://localhost:4001/api/v1/admin/ai-search/config" \
  -H "Authorization: Bearer $TOKEN" | jq '.enabled, .weights'

curl -s -X PATCH "http://localhost:4001/api/v1/admin/ai-search/config" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true,"semanticRetrievalEnabled":true}'
```

### cURL — trigger embedding backfill

```bash
curl -s -X POST "http://localhost:4001/api/v1/admin/ai-search/embedding-jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jobType":"backfill"}'
```

### JavaScript fetch (storefront pattern)

```typescript
const response = await fetch(
  `${SEARCH_API_URL}/api/v1/search?${new URLSearchParams({ query: "drill", page: "1" })}`,
  {
    headers: {
      "X-API-Key": process.env.SEARCH_API_KEY!,
      "X-Session-Id": sessionId,
    },
  },
);
const data: SearchResponseDto = await response.json();
```

---

## 17. Environment variables

Variables that affect API behavior (set on `search-api`):


| Variable                                                          | Effect on API                                             |
| ----------------------------------------------------------------- | --------------------------------------------------------- |
| `SEARCH_API_KEY_REQUIRED`                                         | Require API keys on search/browse/events                  |
| `DEFAULT_API_KEY_RATE_LIMIT`                                      | Default per-key rate limit                                |
| `SESSION_TTL_HOURS`                                               | Session token lifetime                                    |
| `HYBRID_SEARCH_ENABLED`                                           | Enable hybrid ranking pipeline                            |
| `SEMANTIC_SEARCH_ENABLED`                                         | Semantic vector retrieval                                 |
| `PERSONALIZATION_ENABLED`                                         | Session affinity boosts                                   |
| `EMBEDDINGS_PROVIDER` / `EMBEDDINGS_MODEL` / `EMBEDDINGS_API_KEY` | Embedding generation                                      |
| `LEXICAL_WEIGHT` / `SEMANTIC_WEIGHT` / `PERSONALIZATION_WEIGHT`   | Default ranking weights                                   |
| `LLM_*`                                                           | Optional LLM query rewrite, zero-results recovery, rerank |


Full list: `.env.example` and `AI_PERSONALIZATION_VECTOR_SEARCH_PLAN.md`.

---

## Related documentation


| Document                                                                                | Audience                                        |
| --------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [USER_GUIDE.md](./USER_GUIDE.md)                                                        | ForgeOps operators                              |
| [CATALOG_SCALE.md](./CATALOG_SCALE.md)                                                  | Large catalog architecture (up to 80M products) |
| [AI_PERSONALIZATION_VECTOR_SEARCH_PLAN.md](../AI_PERSONALIZATION_VECTOR_SEARCH_PLAN.md) | AI architecture and rollout                     |
| `packages/shared-types`                                                                 | Canonical TypeScript DTOs                       |


---

*Retailer Search Platform — search-api v1*