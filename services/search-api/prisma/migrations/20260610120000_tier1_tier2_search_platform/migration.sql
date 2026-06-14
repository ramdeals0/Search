-- Tier 1/2: API keys, persistent search analytics, product updatedAt index

CREATE INDEX IF NOT EXISTS "Product_updatedAt_idx" ON "Product"("updatedAt");

CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "scopes" TEXT[] DEFAULT ARRAY['search:read', 'browse:read', 'events:write']::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_tenantId_idx" ON "ApiKey"("tenantId");
CREATE INDEX "ApiKey_enabled_idx" ON "ApiKey"("enabled");

CREATE TABLE "SearchEvent" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "apiKeyId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SearchEvent_tenantId_idx" ON "SearchEvent"("tenantId");
CREATE INDEX "SearchEvent_normalizedQuery_idx" ON "SearchEvent"("normalizedQuery");
CREATE INDEX "SearchEvent_resultCount_idx" ON "SearchEvent"("resultCount");
CREATE INDEX "SearchEvent_createdAt_idx" ON "SearchEvent"("createdAt");

CREATE TABLE "SearchClickEvent" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "position" INTEGER,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "apiKeyId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchClickEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SearchClickEvent_tenantId_idx" ON "SearchClickEvent"("tenantId");
CREATE INDEX "SearchClickEvent_productId_idx" ON "SearchClickEvent"("productId");
CREATE INDEX "SearchClickEvent_normalizedQuery_idx" ON "SearchClickEvent"("normalizedQuery");
CREATE INDEX "SearchClickEvent_createdAt_idx" ON "SearchClickEvent"("createdAt");
