-- Admin accounts (separate from platform users) + dispute admin fields

CREATE TYPE "admin_role" AS ENUM ('super_admin', 'admin_manager', 'verifier', 'support_agent');
CREATE TYPE "dispute_status" AS ENUM ('open', 'in_review', 'resolved', 'closed');
CREATE TYPE "dispute_priority" AS ENUM ('low', 'medium', 'high');
CREATE TYPE "dispute_type" AS ENUM ('payment_issue', 'contract_breach', 'harassment', 'other');
CREATE TYPE "dispute_resolution_decision" AS ENUM ('approve_worker', 'approve_employer', 'partial', 'dismiss');

CREATE TABLE "admin_accounts" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "admin_role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invite_pending" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "created_by_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_accounts_email_key" ON "admin_accounts"("email");

CREATE TABLE "admin_permissions" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "permission" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_permissions_admin_id_permission_key" ON "admin_permissions"("admin_id", "permission");
CREATE INDEX "admin_permissions_admin_id_idx" ON "admin_permissions"("admin_id");

CREATE TABLE "admin_department_assignments" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "department_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_department_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_department_assignments_admin_id_department_id_key" ON "admin_department_assignments"("admin_id", "department_id");
CREATE INDEX "admin_department_assignments_admin_id_idx" ON "admin_department_assignments"("admin_id");
CREATE INDEX "admin_department_assignments_department_id_idx" ON "admin_department_assignments"("department_id");

CREATE TABLE "admin_refresh_tokens" (
    "id" TEXT NOT NULL,
    "admin_id" UUID NOT NULL,
    "lookup_digest" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_refresh_tokens_lookup_digest_key" ON "admin_refresh_tokens"("lookup_digest");
CREATE INDEX "admin_refresh_tokens_admin_id_idx" ON "admin_refresh_tokens"("admin_id");
CREATE INDEX "admin_refresh_tokens_expires_at_idx" ON "admin_refresh_tokens"("expires_at");

CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_logs_admin_id_idx" ON "admin_audit_logs"("admin_id");
CREATE INDEX "admin_audit_logs_module_idx" ON "admin_audit_logs"("module");
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

ALTER TABLE "admin_accounts" ADD CONSTRAINT "admin_accounts_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin_permissions" ADD CONSTRAINT "admin_permissions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_department_assignments" ADD CONSTRAINT "admin_department_assignments_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_department_assignments" ADD CONSTRAINT "admin_department_assignments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_refresh_tokens" ADD CONSTRAINT "admin_refresh_tokens_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- v2-only: employer_documents may not exist on legacy production DB
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'employer_documents'
  ) THEN
    ALTER TABLE "employer_documents" ADD COLUMN IF NOT EXISTS "reviewer_admin_id" UUID;
  END IF;
END $$;

-- v2-only: legacy production disputes use camelCase + DisputeStatus enum
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'disputes' AND column_name = 'raised_by_user_id'
  ) THEN
    ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "priority" "dispute_priority" NOT NULL DEFAULT 'medium';
    ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "type" "dispute_type";
    ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "resolution_decision" "dispute_resolution_decision";
    ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "resolution_notes" TEXT;
    ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "refund_amount" INTEGER;
    ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "refund_channel" "momo_provider";

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'disputes'
        AND column_name = 'status' AND udt_name <> 'dispute_status'
    ) THEN
      ALTER TABLE "disputes" ALTER COLUMN "status" DROP DEFAULT;
      ALTER TABLE "disputes" ALTER COLUMN "status" TYPE "dispute_status" USING (
        CASE lower("status"::text)
          WHEN 'open' THEN 'open'::"dispute_status"
          WHEN 'in_review' THEN 'in_review'::"dispute_status"
          WHEN 'under_review' THEN 'in_review'::"dispute_status"
          WHEN 'resolved' THEN 'resolved'::"dispute_status"
          WHEN 'closed' THEN 'closed'::"dispute_status"
          ELSE 'open'::"dispute_status"
        END
      );
      ALTER TABLE "disputes" ALTER COLUMN "status" SET DEFAULT 'open';
    END IF;
  END IF;
END $$;
