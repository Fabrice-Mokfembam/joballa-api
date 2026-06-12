-- Employer portal: company size, shift log attribution, payroll period on payments
ALTER TABLE "employer_profiles" ADD COLUMN IF NOT EXISTS "companySize" TEXT;

ALTER TABLE "shift_logs" ADD COLUMN IF NOT EXISTS "loggedBy" TEXT NOT NULL DEFAULT 'employer';

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payPeriod" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "payments_employer_id_pay_period_idx" ON "payments"("employerId", "payPeriod");
