-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLoginAt" DATETIME
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditTrailEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entityLabel" TEXT,
    "outcome" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "hashChainPrev" TEXT
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
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
    "executedBy" JSONB
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requestedRole" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reviewerUserId" TEXT,
    "reviewerName" TEXT,
    "reviewerNote" TEXT
);

-- CreateTable
CREATE TABLE "AccessReviewRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "scopeRoles" JSONB NOT NULL,
    "completedAt" DATETIME,
    "summary" JSONB
);

-- CreateTable
CREATE TABLE "AccessReviewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "currentRole" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "lastLoginAt" DATETIME,
    "recommendedAction" TEXT,
    "note" TEXT,
    CONSTRAINT "AccessReviewItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AccessReviewRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JitElevationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "baseRole" TEXT NOT NULL,
    "requestedRole" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "requestedDurationMinutes" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedByName" TEXT,
    "reviewerNote" TEXT,
    "activatedAt" DATETIME,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME
);

-- CreateTable
CREATE TABLE "CollaborationComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "author" JSONB NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "tags" JSONB
);

-- CreateTable
CREATE TABLE "CollaborationAnnotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "author" JSONB NOT NULL,
    "anchorLabel" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tags" JSONB
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedApprovalRequestId" TEXT,
    "recipientActorId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "filters" JSONB,
    "fileName" TEXT,
    "recordCount" INTEGER,
    "errorMessage" TEXT
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "subscribedEvents" JSONB NOT NULL,
    "secret" TEXT,
    "lastDeliveryAt" DATETIME,
    "lastDeliveryStatus" TEXT
);

-- CreateTable
CREATE TABLE "WebhookDeliveryLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endpointId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseStatusCode" INTEGER,
    "errorMessage" TEXT,
    "attemptNumber" INTEGER NOT NULL,
    CONSTRAINT "WebhookDeliveryLog_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
