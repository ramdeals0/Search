-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('merchandiser', 'reviewer', 'approver', 'release_manager', 'admin');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('pending', 'approved', 'denied', 'cancelled');

-- CreateEnum
CREATE TYPE "AccessReviewStatus" AS ENUM ('open', 'completed');

-- CreateEnum
CREATE TYPE "JitAccessStatus" AS ENUM ('pending', 'active', 'denied', 'expired', 'cancelled', 'revoked');

-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('generated', 'failed');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('json', 'csv');

-- CreateEnum
CREATE TYPE "ExportTargetType" AS ENUM ('audit_trail', 'approvals', 'access_reviews', 'security_timeline', 'audit_review_findings');

-- CreateEnum
CREATE TYPE "BootstrapStatusEnum" AS ENUM ('not_started', 'admin_created', 'security_configured', 'platform_configured', 'completed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditTrailEntry" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entityLabel" TEXT,
    "outcome" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "hashChainPrev" TEXT,

    CONSTRAINT "AuditTrailEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "sourceEnvironment" TEXT NOT NULL,
    "targetEnvironment" TEXT NOT NULL,
    "snapshotId" TEXT,
    "snapshotName" TEXT,
    "requestedBy" JSONB NOT NULL,
    "approvedBy" JSONB,
    "rejectedBy" JSONB,
    "reason" TEXT NOT NULL,
    "decisionNote" TEXT,
    "linkedExperimentId" TEXT,
    "assignedReviewerIds" JSONB,
    "decisions" JSONB,
    "requiredApprovalCount" INTEGER,
    "executedBy" JSONB,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requestedRole" "UserRole" NOT NULL,
    "justification" TEXT NOT NULL,
    "status" "AccessRequestStatus" NOT NULL,
    "reviewerUserId" TEXT,
    "reviewerName" TEXT,
    "reviewerNote" TEXT,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessReviewRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "status" "AccessReviewStatus" NOT NULL,
    "scopeRoles" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),
    "summary" JSONB,

    CONSTRAINT "AccessReviewRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessReviewItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "currentRole" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "recommendedAction" TEXT,
    "note" TEXT,

    CONSTRAINT "AccessReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JitElevationRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "baseRole" "UserRole" NOT NULL,
    "requestedRole" "UserRole" NOT NULL,
    "justification" TEXT NOT NULL,
    "requestedDurationMinutes" INTEGER NOT NULL,
    "status" "JitAccessStatus" NOT NULL,
    "approvedByUserId" TEXT,
    "approvedByName" TEXT,
    "reviewerNote" TEXT,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "JitElevationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationComment" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "author" JSONB NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "tags" JSONB,

    CONSTRAINT "CollaborationComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationAnnotation" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "author" JSONB NOT NULL,
    "anchorLabel" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tags" JSONB,

    CONSTRAINT "CollaborationAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedApprovalRequestId" TEXT,
    "recipientActorId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "targetType" "ExportTargetType" NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "status" "ExportJobStatus" NOT NULL,
    "filters" JSONB,
    "fileName" TEXT,
    "recordCount" INTEGER,
    "errorMessage" TEXT,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "subscribedEvents" JSONB NOT NULL,
    "secret" TEXT,
    "lastDeliveryAt" TIMESTAMP(3),
    "lastDeliveryStatus" TEXT,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDeliveryLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endpointId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseStatusCode" INTEGER,
    "errorMessage" TEXT,
    "attemptNumber" INTEGER NOT NULL,

    CONSTRAINT "WebhookDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BootstrapState" (
    "id" TEXT NOT NULL,
    "status" "BootstrapStatusEnum" NOT NULL DEFAULT 'not_started',
    "initializedAt" TIMESTAMP(3),
    "initializedByUserId" TEXT,
    "initializedByEmail" TEXT,
    "instanceName" TEXT,
    "firstAdminEmail" TEXT,
    "securityDefaultsApplied" BOOLEAN NOT NULL DEFAULT false,
    "governanceDefaultsApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BootstrapState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "inventory" INTEGER NOT NULL,
    "inStock" BOOLEAN NOT NULL,
    "imageUrl" TEXT,
    "attributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_active_idx" ON "User"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditTrailEntry_timestamp_idx" ON "AuditTrailEntry"("timestamp");

-- CreateIndex
CREATE INDEX "AuditTrailEntry_actionType_idx" ON "AuditTrailEntry"("actionType");

-- CreateIndex
CREATE INDEX "AuditTrailEntry_entityType_idx" ON "AuditTrailEntry"("entityType");

-- CreateIndex
CREATE INDEX "AuditTrailEntry_outcome_idx" ON "AuditTrailEntry"("outcome");

-- CreateIndex
CREATE INDEX "AuditTrailEntry_actorId_idx" ON "AuditTrailEntry"("actorId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_createdAt_idx" ON "ApprovalRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_snapshotId_idx" ON "ApprovalRequest"("snapshotId");

-- CreateIndex
CREATE INDEX "AccessRequest_status_idx" ON "AccessRequest"("status");

-- CreateIndex
CREATE INDEX "AccessRequest_requesterUserId_idx" ON "AccessRequest"("requesterUserId");

-- CreateIndex
CREATE INDEX "AccessRequest_createdAt_idx" ON "AccessRequest"("createdAt");

-- CreateIndex
CREATE INDEX "AccessReviewRun_status_idx" ON "AccessReviewRun"("status");

-- CreateIndex
CREATE INDEX "AccessReviewRun_createdAt_idx" ON "AccessReviewRun"("createdAt");

-- CreateIndex
CREATE INDEX "AccessReviewItem_runId_idx" ON "AccessReviewItem"("runId");

-- CreateIndex
CREATE INDEX "AccessReviewItem_userId_idx" ON "AccessReviewItem"("userId");

-- CreateIndex
CREATE INDEX "JitElevationRequest_status_idx" ON "JitElevationRequest"("status");

-- CreateIndex
CREATE INDEX "JitElevationRequest_requesterUserId_idx" ON "JitElevationRequest"("requesterUserId");

-- CreateIndex
CREATE INDEX "JitElevationRequest_expiresAt_idx" ON "JitElevationRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "JitElevationRequest_createdAt_idx" ON "JitElevationRequest"("createdAt");

-- CreateIndex
CREATE INDEX "CollaborationComment_targetType_targetId_idx" ON "CollaborationComment"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "CollaborationComment_createdAt_idx" ON "CollaborationComment"("createdAt");

-- CreateIndex
CREATE INDEX "CollaborationAnnotation_targetType_targetId_idx" ON "CollaborationAnnotation"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "CollaborationAnnotation_createdAt_idx" ON "CollaborationAnnotation"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_recipientActorId_idx" ON "Notification"("recipientActorId");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_relatedApprovalRequestId_idx" ON "Notification"("relatedApprovalRequestId");

-- CreateIndex
CREATE INDEX "ExportJob_createdAt_idx" ON "ExportJob"("createdAt");

-- CreateIndex
CREATE INDEX "ExportJob_targetType_idx" ON "ExportJob"("targetType");

-- CreateIndex
CREATE INDEX "ExportJob_status_idx" ON "ExportJob"("status");

-- CreateIndex
CREATE INDEX "ExportJob_createdByUserId_idx" ON "ExportJob"("createdByUserId");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_active_idx" ON "WebhookEndpoint"("active");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_createdAt_idx" ON "WebhookEndpoint"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookDeliveryLog_endpointId_idx" ON "WebhookDeliveryLog"("endpointId");

-- CreateIndex
CREATE INDEX "WebhookDeliveryLog_eventType_idx" ON "WebhookDeliveryLog"("eventType");

-- CreateIndex
CREATE INDEX "WebhookDeliveryLog_status_idx" ON "WebhookDeliveryLog"("status");

-- CreateIndex
CREATE INDEX "WebhookDeliveryLog_createdAt_idx" ON "WebhookDeliveryLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "SystemConfig_key_idx" ON "SystemConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE INDEX "Brand_name_idx" ON "Brand"("name");

-- CreateIndex
CREATE INDEX "Category_department_idx" ON "Category"("department");

-- CreateIndex
CREATE UNIQUE INDEX "Category_department_subcategory_key" ON "Category"("department", "subcategory");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_inStock_idx" ON "Product"("inStock");

-- CreateIndex
CREATE INDEX "Product_title_idx" ON "Product"("title");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessReviewItem" ADD CONSTRAINT "AccessReviewItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AccessReviewRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDeliveryLog" ADD CONSTRAINT "WebhookDeliveryLog_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

