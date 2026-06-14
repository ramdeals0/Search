-- Tier 3/4: scheduled releases, rule drafts, API usage meters, export targets, key rate limits

ALTER TYPE "ExportTargetType" ADD VALUE IF NOT EXISTS 'soc2_audit_package';
ALTER TYPE "ExportTargetType" ADD VALUE IF NOT EXISTS 'audit_hash_chain_report';
ALTER TYPE "ExportTargetType" ADD VALUE IF NOT EXISTS 'api_usage_meters';

CREATE TYPE "ScheduledReleaseType" AS ENUM ('promote_snapshot', 'rollback_snapshot');
CREATE TYPE "ScheduledReleaseStatus" AS ENUM ('pending', 'executed', 'cancelled', 'failed');
CREATE TYPE "RuleDraftStatus" AS ENUM ('pending_review', 'approved', 'rejected', 'applied');

ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "rateLimitPerMinute" INTEGER;

CREATE TABLE "ScheduledRelease" (
    "id" TEXT NOT NULL,
    "type" "ScheduledReleaseType" NOT NULL,
    "status" "ScheduledReleaseStatus" NOT NULL DEFAULT 'pending',
    "snapshotId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "linkedExperimentId" TEXT,
    "approvalRequestId" TEXT,
    "errorMessage" TEXT,
    "createdByUserId" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledRelease_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduledRelease_status_scheduledAt_idx" ON "ScheduledRelease"("status", "scheduledAt");
CREATE INDEX "ScheduledRelease_snapshotId_idx" ON "ScheduledRelease"("snapshotId");

CREATE TABLE "RuleDraft" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "status" "RuleDraftStatus" NOT NULL DEFAULT 'pending_review',
    "suggestedRule" JSONB NOT NULL,
    "rationale" TEXT,
    "source" TEXT NOT NULL DEFAULT 'llm',
    "createdByUserId" TEXT,
    "approvalRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RuleDraft_status_idx" ON "RuleDraft"("status");
CREATE INDEX "RuleDraft_query_idx" ON "RuleDraft"("query");

CREATE TABLE "ApiUsageMeter" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "route" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApiUsageMeter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiUsageMeter_apiKeyId_route_windowStart_key" ON "ApiUsageMeter"("apiKeyId", "route", "windowStart");
CREATE INDEX "ApiUsageMeter_tenantId_idx" ON "ApiUsageMeter"("tenantId");
CREATE INDEX "ApiUsageMeter_windowStart_idx" ON "ApiUsageMeter"("windowStart");
