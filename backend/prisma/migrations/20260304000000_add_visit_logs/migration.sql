-- CreateTable
CREATE TABLE "VisitLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "path" TEXT NOT NULL,
    "fullUrl" TEXT,
    "referrer" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "userType" TEXT,
    "role" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'page_view',

    CONSTRAINT "VisitLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitLog_createdAt_idx" ON "VisitLog"("createdAt");

-- CreateIndex
CREATE INDEX "VisitLog_ip_idx" ON "VisitLog"("ip");

-- CreateIndex
CREATE INDEX "VisitLog_path_idx" ON "VisitLog"("path");
