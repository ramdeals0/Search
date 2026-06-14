-- Session.lastActivityAt was added to the Prisma schema for inactivity timeouts
-- but was missing from the postgres baseline migration.

ALTER TABLE "Session" ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Session_lastActivityAt_idx" ON "Session"("lastActivityAt");
