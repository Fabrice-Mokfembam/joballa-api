-- Departments table + admin audit fields (database-data-structure doc May 2026)

CREATE TYPE "DepartmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "category" "DepartmentCategory" NOT NULL,
    "description" TEXT,
    "employerProfileId" TEXT,
    "status" "DepartmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departments_slug_key" ON "departments"("slug");
CREATE UNIQUE INDEX "departments_employerProfileId_key" ON "departments"("employerProfileId");
CREATE INDEX "departments_category_idx" ON "departments"("category");
CREATE INDEX "departments_status_idx" ON "departments"("status");

ALTER TABLE "employer_profiles" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
CREATE INDEX IF NOT EXISTS "employer_profiles_departmentId_idx" ON "employer_profiles"("departmentId");

ALTER TABLE "admin_actions" ADD COLUMN IF NOT EXISTS "scope" TEXT;
ALTER TABLE "admin_actions" ADD COLUMN IF NOT EXISTS "entityLabel" TEXT;
CREATE INDEX IF NOT EXISTS "admin_actions_scope_idx" ON "admin_actions"("scope");

ALTER TABLE "departments" ADD CONSTRAINT "departments_employerProfileId_fkey"
  FOREIGN KEY ("employerProfileId") REFERENCES "employer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employer_profiles" ADD CONSTRAINT "employer_profiles_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill Joballa departments from existing employer_profiles (preserve ids for legacy assignedDepartmentId)
INSERT INTO "departments" ("id", "name", "slug", "email", "category", "status", "employerProfileId", "createdAt", "updatedAt")
SELECT
    ep."id",
    ep."companyName",
    LOWER(REGEXP_REPLACE(COALESCE(ep."companyName", 'department'), '[^a-zA-Z0-9]+', '-', 'g'))
        || '-' || SUBSTRING(ep."id", 1, 8),
    COALESCE(u."email", 'department@joballa.cm'),
    COALESCE(ep."departmentCategory", 'DOMESTIC'::"DepartmentCategory"),
    'ACTIVE'::"DepartmentStatus",
    ep."id",
    ep."createdAt",
    ep."updatedAt"
FROM "employer_profiles" ep
LEFT JOIN "users" u ON u."id" = ep."userId"
WHERE ep."isJoballaDepartment" = true
ON CONFLICT ("id") DO NOTHING;

UPDATE "employer_profiles" ep
SET "departmentId" = ep."id"
WHERE ep."isJoballaDepartment" = true AND ep."departmentId" IS NULL;

-- Platform admins are not department-scoped (migration path E.3)
UPDATE "users"
SET "assignedDepartmentId" = NULL
WHERE "role" IN ('ADMIN', 'SUPER_ADMIN');
