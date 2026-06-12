-- Align database with DATABASE_DATA_STRUCTURE doc (May 2026)

-- CreateEnum
CREATE TYPE "JobCreatedByType" AS ENUM ('EMPLOYER', 'WORKER');

-- CreateTable
CREATE TABLE "worker_payment_accounts" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "provider" "MomoProvider" NOT NULL,
    "phone" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_payment_accounts_pkey" PRIMARY KEY ("id")
);

-- AlterTable: worker_profiles
ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "profileStrengthBreakdown" JSONB;
ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "profileViews" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: work_histories
ALTER TABLE "work_histories" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "work_histories" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "work_histories" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "work_histories" ADD COLUMN IF NOT EXISTS "startMonth" TEXT;
ALTER TABLE "work_histories" ADD COLUMN IF NOT EXISTS "startYear" INTEGER;
ALTER TABLE "work_histories" ADD COLUMN IF NOT EXISTS "endMonth" TEXT;
ALTER TABLE "work_histories" ADD COLUMN IF NOT EXISTS "endYear" INTEGER;

-- AlterTable: educations
ALTER TABLE "educations" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "educations" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "educations" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "educations" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "educations" ADD COLUMN IF NOT EXISTS "startMonth" TEXT;
ALTER TABLE "educations" ADD COLUMN IF NOT EXISTS "startYear" INTEGER;
ALTER TABLE "educations" ADD COLUMN IF NOT EXISTS "endMonth" TEXT;
ALTER TABLE "educations" ADD COLUMN IF NOT EXISTS "endYear" INTEGER;

-- AlterTable: certifications
ALTER TABLE "certifications" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "certifications" ADD COLUMN IF NOT EXISTS "credentialUrl" TEXT;
ALTER TABLE "certifications" ADD COLUMN IF NOT EXISTS "documentId" TEXT;

-- AlterTable: kyc_submissions
ALTER TABLE "kyc_submissions" ADD COLUMN IF NOT EXISTS "selfieImageUrl" TEXT;

-- AlterTable: employer_profiles
ALTER TABLE "employer_profiles" ADD COLUMN IF NOT EXISTS "tagline" TEXT;

-- AlterTable: jobs
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "createdByWorkerId" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "createdByType" "JobCreatedByType" NOT NULL DEFAULT 'EMPLOYER';
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "region" TEXT;

-- AlterTable: applications
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "matchPercent" INTEGER;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "lastStatusMessage" TEXT;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "interviewAt" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "offerValidUntil" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "archivedByWorkerAt" TIMESTAMP(3);

-- AlterTable: work_engagements
ALTER TABLE "work_engagements" ADD COLUMN IF NOT EXISTS "roleLabel" TEXT;

-- AlterTable: payments
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paymentPlatform" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "worker_payment_accounts_workerId_idx" ON "worker_payment_accounts"("workerId");

CREATE UNIQUE INDEX IF NOT EXISTS "worker_payment_accounts_workerId_provider_phone_key" ON "worker_payment_accounts"("workerId", "provider", "phone");

-- AddForeignKey
ALTER TABLE "worker_payment_accounts" DROP CONSTRAINT IF EXISTS "worker_payment_accounts_workerId_fkey";
ALTER TABLE "worker_payment_accounts" ADD CONSTRAINT "worker_payment_accounts_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "certifications" DROP CONSTRAINT IF EXISTS "certifications_documentId_fkey";
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "worker_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "jobs" DROP CONSTRAINT IF EXISTS "jobs_createdByWorkerId_fkey";
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_createdByWorkerId_fkey" FOREIGN KEY ("createdByWorkerId") REFERENCES "worker_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
