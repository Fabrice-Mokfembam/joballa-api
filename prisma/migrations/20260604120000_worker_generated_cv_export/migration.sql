-- Worker profile: persisted Joballa-generated CV export metadata
ALTER TABLE "worker_profiles"
  ADD COLUMN IF NOT EXISTS "generated_cv_url" TEXT,
  ADD COLUMN IF NOT EXISTS "generated_cv_public_id" TEXT,
  ADD COLUMN IF NOT EXISTS "generated_cv_file_name" TEXT,
  ADD COLUMN IF NOT EXISTS "generated_cv_document_id" UUID,
  ADD COLUMN IF NOT EXISTS "generated_cv_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "generated_cv_source_profile_updated_at" TIMESTAMP(3);
