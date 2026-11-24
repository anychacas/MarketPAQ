-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profileReminderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "profileReminderSentAt" TIMESTAMP(3);
