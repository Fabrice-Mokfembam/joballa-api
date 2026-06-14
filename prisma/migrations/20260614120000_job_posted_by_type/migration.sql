-- CreateEnum
CREATE TYPE "job_posted_by_type" AS ENUM ('worker', 'company');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "posted_by_type" "job_posted_by_type";

-- Backfill from job owner role
UPDATE "jobs"
SET "posted_by_type" = CASE
  WHEN u.role = 'worker' THEN 'worker'::"job_posted_by_type"
  ELSE 'company'::"job_posted_by_type"
END
FROM "users" u
WHERE "jobs"."owner_id" = u.id;

-- Require value for all rows
ALTER TABLE "jobs" ALTER COLUMN "posted_by_type" SET NOT NULL;
