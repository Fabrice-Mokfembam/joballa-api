-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "created_by_admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "jobs" ADD COLUMN "created_by_admin_id" UUID;
