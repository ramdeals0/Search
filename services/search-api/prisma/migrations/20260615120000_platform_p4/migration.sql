-- P4: Multi-catalog, developer role, API key self-service

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'developer';

CREATE TABLE "Catalog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Catalog_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Catalog" ("id", "tenantId", "slug", "name", "description", "isDefault", "active", "updatedAt")
VALUES (
    'default',
    'default',
    'default',
    'Default catalog',
    'Primary product catalog for this tenant',
    true,
    true,
    CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Catalog_tenantId_slug_key" ON "Catalog"("tenantId", "slug");
CREATE INDEX "Catalog_tenantId_idx" ON "Catalog"("tenantId");
CREATE INDEX "Catalog_active_idx" ON "Catalog"("active");

ALTER TABLE "Product" ADD COLUMN "catalogId" TEXT NOT NULL DEFAULT 'default';

UPDATE "Product" SET "catalogId" = 'default' WHERE "catalogId" IS NULL OR "catalogId" = 'default';

ALTER TABLE "Product" ADD CONSTRAINT "Product_catalogId_fkey"
    FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Product_catalogId_idx" ON "Product"("catalogId");

ALTER TABLE "ApiKey" ADD COLUMN "ownerUserId" TEXT;

CREATE INDEX "ApiKey_ownerUserId_idx" ON "ApiKey"("ownerUserId");
