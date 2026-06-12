-- Application source + nullable job department + merge dispute in_review into open

CREATE TYPE "application_source" AS ENUM ('web', 'mobile_app');

ALTER TABLE "applications" ADD COLUMN "source" "application_source";

ALTER TABLE "jobs" ALTER COLUMN "department_id" DROP NOT NULL;

UPDATE "disputes" SET "status" = 'open' WHERE "status" = 'in_review';

-- PostgreSQL: remove in_review from dispute_status enum
ALTER TYPE "dispute_status" RENAME TO "dispute_status_old";
CREATE TYPE "dispute_status" AS ENUM ('open', 'resolved', 'closed');
ALTER TABLE "disputes"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "dispute_status"
    USING ("status"::text::"dispute_status");
ALTER TABLE "disputes" ALTER COLUMN "status" SET DEFAULT 'open';
DROP TYPE "dispute_status_old";
