import { JobStatus } from '@prisma/client';

/** API-facing job status strings (employer portal). */
export type EmployerJobStatusApi =
  | 'draft'
  | 'pending_review'
  | 'live'
  | 'paused'
  | 'closed'
  | 'rejected';

export function jobStatusToApi(status: JobStatus): EmployerJobStatusApi {
  switch (status) {
    case JobStatus.DRAFT:
      return 'draft';
    case JobStatus.UNDER_REVIEW:
      return 'pending_review';
    case JobStatus.ACTIVE:
      return 'live';
    case JobStatus.PAUSED:
      return 'paused';
    case JobStatus.CLOSED:
      return 'closed';
    case JobStatus.REJECTED:
      return 'rejected';
    default:
      return 'draft';
  }
}

export function apiStatusToJobStatus(
  api: string,
): JobStatus | 'all' | undefined {
  const normalized = api.trim().toLowerCase();
  switch (normalized) {
    case 'draft':
      return JobStatus.DRAFT;
    case 'pending_review':
    case 'under_review':
      return JobStatus.UNDER_REVIEW;
    case 'live':
    case 'active':
      return JobStatus.ACTIVE;
    case 'paused':
      return JobStatus.PAUSED;
    case 'closed':
      return JobStatus.CLOSED;
    case 'rejected':
      return JobStatus.REJECTED;
    case 'all':
      return 'all';
    default:
      return undefined;
  }
}
