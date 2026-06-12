-- Align worker_documents.updatedAt with Prisma @updatedAt (no column default)
ALTER TABLE "worker_documents" ALTER COLUMN "updatedAt" DROP DEFAULT;
