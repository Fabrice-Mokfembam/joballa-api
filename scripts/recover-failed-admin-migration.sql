-- Recovery after failed deploy of 20260605120000_admin_accounts_v2 (P3018 / UUID vs TEXT FK).
-- Run against the Neon production database, then:
--   npx prisma migrate resolve --rolled-back 20260605120000_admin_accounts_v2
-- Redeploy on Render (migrate deploy will re-apply the fixed migration).

DROP TABLE IF EXISTS "admin_audit_logs" CASCADE;
DROP TABLE IF EXISTS "admin_refresh_tokens" CASCADE;
DROP TABLE IF EXISTS "admin_department_assignments" CASCADE;
DROP TABLE IF EXISTS "admin_permissions" CASCADE;
DROP TABLE IF EXISTS "admin_accounts" CASCADE;

DROP TYPE IF EXISTS "dispute_resolution_decision";
DROP TYPE IF EXISTS "dispute_type";
DROP TYPE IF EXISTS "dispute_priority";
DROP TYPE IF EXISTS "dispute_status";
DROP TYPE IF EXISTS "admin_role";

-- Lines 91+ of the admin migration did not run on the failed deploy; no rollback needed for:
--   employer_documents.reviewer_admin_id, disputes enum columns
