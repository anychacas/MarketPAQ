-- Convert licenseType from nullable String to String[]
ALTER TABLE "Addon" DROP COLUMN IF EXISTS "licenseType";
ALTER TABLE "Addon" ADD COLUMN "licenseType" TEXT[] NOT NULL DEFAULT '{}';
