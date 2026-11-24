-- Migration: add_partner_leader_fields
-- Adds the three-tier role system: partner / partner leader / developer
-- "distributor" is renamed to "partner" in userType.
-- Partner Leaders are partners approved by an admin, identified by isPartnerLeader=true
-- and a unique partnerLeaderCode generated at approval time.

-- ── Step 1: Add new columns to User ──────────────────────────────────────────

-- true only for admin-approved Partner Leaders
ALTER TABLE "User" ADD COLUMN "isPartnerLeader" BOOLEAN NOT NULL DEFAULT false;

-- Unique invite code generated automatically upon approval; NULL for all others
ALTER TABLE "User" ADD COLUMN "partnerLeaderCode" TEXT;

-- true for developers (backfilled below); false for partners and partner leaders
ALTER TABLE "User" ADD COLUMN "canPublishAddons" BOOLEAN NOT NULL DEFAULT false;

-- FK to the Partner Leader who referred this user (nullable self-relation)
ALTER TABLE "User" ADD COLUMN "uplinePartnerLeaderId" TEXT;

-- "none" | "pending" | "approved" | "rejected"
ALTER TABLE "User" ADD COLUMN "partnerLeaderRequestStatus" TEXT NOT NULL DEFAULT 'none';

-- ── Step 2: Unique index for partnerLeaderCode ────────────────────────────────
-- Nullable unique: only non-NULL values are constrained to be unique.
-- Postgres enforces this correctly (multiple NULLs are allowed).
CREATE UNIQUE INDEX "User_partnerLeaderCode_key" ON "User"("partnerLeaderCode");

-- ── Step 3: Self-referential FK for the upline relation ───────────────────────
-- ON DELETE SET NULL: if a Partner Leader account is deleted, partners'
-- uplinePartnerLeaderId becomes NULL (they are not deleted).
ALTER TABLE "User" ADD CONSTRAINT "User_uplinePartnerLeaderId_fkey"
  FOREIGN KEY ("uplinePartnerLeaderId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- ── Step 4: Backfill existing data ────────────────────────────────────────────

-- 4a. Rename 'distributor' → 'partner' (all existing distributors become partners)
UPDATE "User" SET "userType" = 'partner' WHERE "userType" = 'distributor';

-- 4b. Grant publish access to all existing developers
--     (new users get canPublishAddons=false by default; developers must have it true)
UPDATE "User" SET "canPublishAddons" = true WHERE "userType" = 'developer';

-- 4c. partnerLeaderRequestStatus defaults to 'none' for all rows — already handled
--     by the DEFAULT 'none' on the ADD COLUMN above; no additional UPDATE needed.
