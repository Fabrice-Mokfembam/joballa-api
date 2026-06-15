import type { Notification, NotificationType } from '@prisma/client';

export type PushNotificationRecord = Pick<
  Notification,
  'id' | 'userId' | 'type' | 'title' | 'body' | 'relatedType' | 'relatedId'
>;

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
  priority: 'high';
};

export type ExpoPushTicket =
  | { status: 'ok'; id?: string }
  | { status: 'error'; message?: string; details?: { error?: string } };

export type ExpoPushResponse = {
  data?: ExpoPushTicket[];
};

export function shouldSendPushForType(
  type: NotificationType,
  settings: {
    pushEnabled: boolean;
    applicationUpdates: boolean;
    jobUpdates: boolean;
    paymentUpdates: boolean;
    engagementUpdates: boolean;
    securityAlerts: boolean;
    marketingUpdates: boolean;
  },
): boolean {
  if (!settings.pushEnabled) return false;

  switch (type) {
    case 'APPLICATION_RECEIVED':
    case 'APPLICATION_UPDATE':
      return settings.applicationUpdates;
    case 'JOB_APPROVED':
    case 'JOB_REJECTED':
      return settings.jobUpdates;
    case 'PAYMENT_SENT':
    case 'PAYMENT_RECEIVED':
      return settings.paymentUpdates;
    case 'ENGAGEMENT_UPDATE':
      return settings.engagementUpdates;
    case 'SECURITY_ALERT':
      return settings.securityAlerts;
    case 'SYSTEM':
      return settings.marketingUpdates;
    case 'VERIFICATION_UPDATE':
      return true;
    default:
      return true;
  }
}
