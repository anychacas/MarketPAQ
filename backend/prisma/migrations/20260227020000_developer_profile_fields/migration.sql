-- Migration: 20260227020000_developer_profile_fields
-- Adds optional fields to DeveloperProfile used by the frontend form.
-- All new columns are nullable (or have defaults), so this is non-destructive.

-- AlterTable
ALTER TABLE "DeveloperProfile"
  ADD COLUMN "contpaqi"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "softrestaurant" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "logoUrl"        TEXT,
  ADD COLUMN "location"       TEXT,
  ADD COLUMN "services"       TEXT,
  ADD COLUMN "responseTime"   TEXT;
