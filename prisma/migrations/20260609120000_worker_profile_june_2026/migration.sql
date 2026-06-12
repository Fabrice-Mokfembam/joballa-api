-- Application profile drafts (per-job customize before apply)
CREATE TABLE IF NOT EXISTS "application_profile_drafts" (
    "id" UUID NOT NULL,
    "worker_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "customized_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_profile_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "application_profile_drafts_worker_id_job_id_key"
    ON "application_profile_drafts"("worker_id", "job_id");

CREATE INDEX IF NOT EXISTS "application_profile_drafts_worker_id_idx"
    ON "application_profile_drafts"("worker_id");

DO $$ BEGIN
    ALTER TABLE "application_profile_drafts"
        ADD CONSTRAINT "application_profile_drafts_worker_id_fkey"
        FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "application_profile_drafts"
        ADD CONSTRAINT "application_profile_drafts_job_id_fkey"
        FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
