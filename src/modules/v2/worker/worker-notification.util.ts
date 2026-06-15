import { NotificationType } from '@prisma/client';

export type WorkerNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedType?: string;
  relatedId?: string;
};

export function notificationDeepLink(
  type: NotificationType,
  relatedType?: string | null,
  relatedId?: string | null,
): string | null {
  if (!relatedId) return null;
  if (
    type === NotificationType.APPLICATION_UPDATE ||
    type === NotificationType.APPLICATION_RECEIVED
  ) {
    return `/worker/applications/${relatedId}`;
  }
  if (type === NotificationType.VERIFICATION_UPDATE) {
    return '/worker/profile/kyc';
  }
  if (
    type === NotificationType.PAYMENT_RECEIVED ||
    type === NotificationType.PAYMENT_SENT
  ) {
    return '/worker/earnings';
  }
  if (type === NotificationType.ENGAGEMENT_UPDATE) {
    return `/worker/engagements/${relatedId}`;
  }
  if (relatedType === 'job') return `/worker/jobs/${relatedId}`;
  return null;
}

export function notificationApiType(type: NotificationType): string {
  const map: Partial<Record<NotificationType, string>> = {
    [NotificationType.APPLICATION_RECEIVED]: 'application_submitted',
    [NotificationType.APPLICATION_UPDATE]: 'application_update',
    [NotificationType.VERIFICATION_UPDATE]: 'kyc_update',
    [NotificationType.PAYMENT_RECEIVED]: 'payment_received',
    [NotificationType.PAYMENT_SENT]: 'payment_sent',
    [NotificationType.ENGAGEMENT_UPDATE]: 'contract_update',
    [NotificationType.JOB_APPROVED]: 'job_match_found',
    [NotificationType.JOB_REJECTED]: 'saved_job_updated',
    [NotificationType.SECURITY_ALERT]: 'security_alert',
    [NotificationType.SYSTEM]: 'system',
  };
  return map[type] ?? type.toLowerCase();
}
