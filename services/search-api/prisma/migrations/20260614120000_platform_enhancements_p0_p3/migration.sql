-- P0-P3 platform enhancements: experiments persistence, discovery, modules, commerce, personalization

CREATE TABLE "EvaluationQuerySet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "queries" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvaluationQuerySet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExperimentRecord" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "baselineSnapshotId" TEXT NOT NULL,
    "candidateSnapshotId" TEXT NOT NULL,
    "querySetId" TEXT NOT NULL,
    "candidateLlmOverrides" JSONB,
    "lastRunAt" TIMESTAMP(3),
    "onlineEnabled" BOOLEAN NOT NULL DEFAULT false,
    "onlineTrafficPercent" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExperimentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExperimentRunRecord" (
    "experimentId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExperimentRunRecord_pkey" PRIMARY KEY ("experimentId")
);

CREATE TABLE "ExperimentScorecardRecord" (
    "experimentId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExperimentScorecardRecord_pkey" PRIMARY KEY ("experimentId")
);

CREATE TABLE "ExperimentDecisionRecord" (
    "experimentId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExperimentDecisionRecord_pkey" PRIMARY KEY ("experimentId")
);

CREATE TABLE "SearchContentModule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "environment" TEXT NOT NULL DEFAULT 'staging',
    "moduleType" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "condition" JSONB NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SearchContentModule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductEmbedding" (
    "productId" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductEmbedding_pkey" PRIMARY KEY ("productId")
);

CREATE TABLE "ShopperProfile" (
    "sessionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "affinities" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopperProfile_pkey" PRIMARY KEY ("sessionId")
);

CREATE TABLE "CommerceEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sessionId" TEXT,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "query" TEXT,
    "productId" TEXT,
    "amountCents" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommerceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExperimentRecord_status_idx" ON "ExperimentRecord"("status");
CREATE INDEX "ExperimentRecord_querySetId_idx" ON "ExperimentRecord"("querySetId");
CREATE INDEX "ExperimentRecord_onlineEnabled_idx" ON "ExperimentRecord"("onlineEnabled");
CREATE INDEX "SearchContentModule_environment_active_idx" ON "SearchContentModule"("environment", "active");
CREATE INDEX "ShopperProfile_tenantId_idx" ON "ShopperProfile"("tenantId");
CREATE INDEX "CommerceEvent_type_createdAt_idx" ON "CommerceEvent"("type", "createdAt");
CREATE INDEX "CommerceEvent_sessionId_idx" ON "CommerceEvent"("sessionId");
CREATE INDEX "CommerceEvent_tenantId_idx" ON "CommerceEvent"("tenantId");

ALTER TABLE "ExperimentRecord" ADD CONSTRAINT "ExperimentRecord_querySetId_fkey" FOREIGN KEY ("querySetId") REFERENCES "EvaluationQuerySet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentRunRecord" ADD CONSTRAINT "ExperimentRunRecord_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "ExperimentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentScorecardRecord" ADD CONSTRAINT "ExperimentScorecardRecord_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "ExperimentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentDecisionRecord" ADD CONSTRAINT "ExperimentDecisionRecord_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "ExperimentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
