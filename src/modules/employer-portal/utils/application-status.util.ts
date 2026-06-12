import { ApplicationStatus, EngagementStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

export type ApplicantStatusApi =
  | 'pending'
  | 'shortlisted'
  | 'rejected'
  | 'hired';

export function applicationStatusToApi(
  status: ApplicationStatus,
): ApplicantStatusApi {
  switch (status) {
    case ApplicationStatus.SUBMITTED:
      return 'pending';
    case ApplicationStatus.SHORTLISTED:
      return 'shortlisted';
    case ApplicationStatus.REJECTED:
      return 'rejected';
    case ApplicationStatus.HIRED:
      return 'hired';
    default:
      return 'pending';
  }
}

export function apiToApplicationStatus(api: string): ApplicationStatus {
  const key = api.trim().toLowerCase();
  switch (key) {
    case 'pending':
    case 'submitted':
      return ApplicationStatus.SUBMITTED;
    case 'shortlisted':
      return ApplicationStatus.SHORTLISTED;
    case 'rejected':
      return ApplicationStatus.REJECTED;
    case 'hired':
      return ApplicationStatus.HIRED;
    default:
      throw new BadRequestException(
        `Invalid application status. Use: pending, shortlisted, rejected, hired.`,
      );
  }
}

export function engagementStatusFromApi(api: string): EngagementStatus {
  const key = api.trim().toLowerCase();
  switch (key) {
    case 'active':
      return EngagementStatus.ACTIVE;
    case 'terminated':
      return EngagementStatus.TERMINATED;
    case 'completed':
    case 'ended':
      return EngagementStatus.COMPLETED;
    default:
      throw new BadRequestException(
        'Invalid workforce status. Use: active, terminated, or completed.',
      );
  }
}
