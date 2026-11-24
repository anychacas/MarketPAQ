-- Add passwordHash column for real JWT auth (nullable, non-destructive)
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
