import { NotFoundException } from '@nestjs/common';
import {
  mergeApplicantDocuments,
  normalizeApplicantProfileSnapshot,
  normalizeAttachedDocuments,
  type ApplicantDocumentEntry,
} from '../employer/employer-applicant-snapshot.util';

export function listApplicantDownloadableFiles(application: {
  profileSnapshot: unknown;
  attachedDocuments: unknown;
  job?: { requiredSkills?: string[] };
  worker?: unknown;
}): ApplicantDocumentEntry[] {
  const snapshot = normalizeApplicantProfileSnapshot(
    application.profileSnapshot,
    {
      jobRequiredSkills: application.job?.requiredSkills ?? [],
      snapshotOnly: true,
    },
  );
  return mergeApplicantDocuments(snapshot, application.attachedDocuments);
}

export function resolveApplicantFileByIndex(
  application: Parameters<typeof listApplicantDownloadableFiles>[0],
  fileIndex: number,
): ApplicantDocumentEntry {
  const files = listApplicantDownloadableFiles(application);
  const file = files[fileIndex];
  if (!file?.url) {
    throw new NotFoundException('File not found.');
  }
  return file;
}
