import type { ApplicantDocumentEntry } from '../employer/employer-applicant-snapshot.util';

export type DocumentUrlContext =
  | { scope: 'employer-applicant'; applicationId: string }
  | { scope: 'worker-applicant'; applicationId: string }
  | { scope: 'worker-application'; applicationId: string };

export function applicantFileDownloadPath(
  context: DocumentUrlContext,
  fileIndex: number,
): string {
  const idx = String(fileIndex);
  switch (context.scope) {
    case 'employer-applicant':
      return `/employer/applicants/${context.applicationId}/files/${idx}/download`;
    case 'worker-applicant':
      return `/worker/applicants/${context.applicationId}/files/${idx}/download`;
    case 'worker-application':
      return `/worker/applications/${context.applicationId}/files/${idx}/download`;
  }
}

export function workerCvDownloadPath(): string {
  return '/worker/profile/cv-export';
}

export function enrichApplicantDocuments(
  documents: ApplicantDocumentEntry[],
  context: DocumentUrlContext,
): ApplicantDocumentEntry[] {
  return documents.map((doc, index) => ({
    ...doc,
    downloadUrl: applicantFileDownloadPath(context, index),
  }));
}
