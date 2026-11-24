-- Migration: 20260227010000_addon_schema_align
-- Aligns Addon schema with frontend field names (name/ownerUserId) and adds
-- missing fields. Safe on empty tables (no data to migrate).
-- Also adds User.role for admin access checks.

-- DropForeignKey
ALTER TABLE "Addon" DROP CONSTRAINT "Addon_userId_fkey";

-- DropForeignKey
ALTER TABLE "Addon" DROP CONSTRAINT "Addon_developerId_fkey";

-- AlterTable: User — add role field
ALTER TABLE "User" ADD COLUMN "role" TEXT;

-- AlterTable: Addon — rename title→name, userId→ownerUserId, add new fields
-- Tables are empty (init migration just created them), so DROP+ADD is safe.
ALTER TABLE "Addon"
  DROP COLUMN "title",
  DROP COLUMN "userId",
  ADD COLUMN "name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "ownerUserId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "vendor" TEXT,
  ADD COLUMN "contpaqi" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "softrestaurant" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tags" TEXT[],
  ADD COLUMN "website" TEXT,
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactWhatsApp" TEXT,
  ALTER COLUMN "developerId" DROP NOT NULL;

-- Remove temporary defaults (columns are NOT NULL in schema, default only needed during ALTER)
ALTER TABLE "Addon" ALTER COLUMN "name" DROP DEFAULT;
ALTER TABLE "Addon" ALTER COLUMN "ownerUserId" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Addon" ADD CONSTRAINT "Addon_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Addon" ADD CONSTRAINT "Addon_developerId_fkey"
  FOREIGN KEY ("developerId") REFERENCES "DeveloperProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
