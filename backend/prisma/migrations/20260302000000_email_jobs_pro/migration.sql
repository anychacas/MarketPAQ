-- Migration: email_jobs_pro
-- Adds job scheduling system + email idempotency logs

-- JobDefinition: stores named recurring/one-time job configs
CREATE TABLE "JobDefinition" (
    "id"           TEXT NOT NULL,
    "key"          TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "scheduleType" TEXT NOT NULL,
    "scheduleExpr" TEXT,
    "isEnabled"    BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt"    TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobDefinition_key_key" ON "JobDefinition"("key");

-- JobRun: execution log + lock state for each job tick
CREATE TABLE "JobRun" (
    "id"           TEXT NOT NULL,
    "jobKey"       TEXT NOT NULL,
    "status"       TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "startedAt"    TIMESTAMP(3),
    "finishedAt"   TIMESTAMP(3),
    "attempt"      INTEGER NOT NULL DEFAULT 0,
    "maxAttempts"  INTEGER NOT NULL DEFAULT 3,
    "lockedBy"     TEXT,
    "lockedAt"     TIMESTAMP(3),
    "error"        TEXT,
    "meta"         JSONB,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobRun_jobKey_status_idx" ON "JobRun"("jobKey", "status");
CREATE INDEX "JobRun_scheduledFor_idx" ON "JobRun"("scheduledFor");

-- EmailDigestLog: idempotency guard for periodic digest emails
CREATE TABLE "EmailDigestLog" (
    "id"        TEXT NOT NULL,
    "kind"      TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "sentAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta"      JSONB,

    CONSTRAINT "EmailDigestLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailDigestLog_kind_periodKey_key" ON "EmailDigestLog"("kind", "periodKey");

-- EmailSendLog: anti-spam for one-time transactional emails
CREATE TABLE "EmailSendLog" (
    "id"        TEXT NOT NULL,
    "kind"      TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta"      JSONB,

    CONSTRAINT "EmailSendLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailSendLog_kind_userId_key" ON "EmailSendLog"("kind", "userId");
CREATE INDEX "EmailSendLog_kind_idx" ON "EmailSendLog"("kind");
