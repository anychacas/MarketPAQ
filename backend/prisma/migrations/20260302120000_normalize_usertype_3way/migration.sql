-- Normalize to 3-way userType: partner | developer | partner_leader
-- Remove approval-flow columns: isPartnerLeader, partnerLeaderRequestStatus

-- Step 1a: backfill — confirmed PL (approved via old flow)
UPDATE "User"
SET "userType" = 'partner_leader', "canPublishAddons" = true
WHERE "isPartnerLeader" = true AND "partnerLeaderCode" IS NOT NULL;

-- Step 1b: backfill — any user with a partnerLeaderCode but isPartnerLeader somehow false (data guard)
UPDATE "User"
SET "userType" = 'partner_leader', "canPublishAddons" = true
WHERE "partnerLeaderCode" IS NOT NULL
  AND "userType" != 'partner_leader';

-- Step 2: ensure developers have canPublishAddons=true (safe re-apply)
UPDATE "User"
SET "canPublishAddons" = true
WHERE "userType" = 'developer';

-- Step 3: ensure partners have canPublishAddons=false (unless they're admin, which is role-based bypass)
UPDATE "User"
SET "canPublishAddons" = false
WHERE "userType" = 'partner'
  AND ("role" IS NULL OR "role" != 'admin');

-- Step 4: drop deprecated columns (IF EXISTS = safe to re-run / idempotent)
ALTER TABLE "User" DROP COLUMN IF EXISTS "isPartnerLeader";
ALTER TABLE "User" DROP COLUMN IF EXISTS "partnerLeaderRequestStatus";
