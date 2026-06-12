-- Migrate users away from Clerk to backend-managed passwords.

DROP INDEX IF EXISTS "users_clerkId_key";

ALTER TABLE "users" DROP COLUMN IF EXISTS "clerkId";

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

UPDATE "users"
SET "email" = COALESCE(NULLIF(trim("email"), ''), 'user-' || "id" || '@migration.joballa.invalid')
WHERE "email" IS NULL OR trim("email") = '';

ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
