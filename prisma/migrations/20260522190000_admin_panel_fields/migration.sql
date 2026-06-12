-- Admin panel: document review, KYC fields, admin notes, settings, user department scope

CREATE TYPE "DocumentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUESTED', 'EXPIRED');
CREATE TYPE "DocumentRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

ALTER TYPE "DepartmentCategory" ADD VALUE IF NOT EXISTS 'TECH';
ALTER TYPE "DisputeStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_USER';
ALTER TYPE "DisputeStatus" ADD VALUE IF NOT EXISTS 'ESCALATED';

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "assignedDepartmentId" TEXT;

ALTER TABLE "worker_documents" ADD COLUMN IF NOT EXISTS "reviewStatus" "DocumentReviewStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "worker_documents" ADD COLUMN IF NOT EXISTS "riskLevel" "DocumentRiskLevel" NOT NULL DEFAULT 'LOW';
ALTER TABLE "worker_documents" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "worker_documents" ADD COLUMN IF NOT EXISTS "departmentCategory" "DepartmentCategory";
ALTER TABLE "worker_documents" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "worker_documents" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;
ALTER TABLE "worker_documents" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "kyc_submissions" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "kyc_submissions" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;

ALTER TABLE "admin_actions" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "admin_actions" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

CREATE INDEX IF NOT EXISTS "worker_documents_reviewStatus_idx" ON "worker_documents"("reviewStatus");
CREATE INDEX IF NOT EXISTS "kyc_submissions_status_idx" ON "kyc_submissions"("status");
CREATE INDEX IF NOT EXISTS "admin_actions_performedAt_idx" ON "admin_actions"("performedAt");

CREATE TABLE IF NOT EXISTS "admin_review_notes" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_review_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "platform_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "admin_review_notes" ADD CONSTRAINT "admin_review_notes_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "admin_review_notes_entityType_entityId_idx" ON "admin_review_notes"("entityType", "entityId");
