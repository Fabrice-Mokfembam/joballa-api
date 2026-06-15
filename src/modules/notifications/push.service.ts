import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { notificationApiType } from '../v2/worker/worker-notification.util';
import type {
  ExpoPushMessage,
  ExpoPushResponse,
  PushNotificationRecord,
} from './push.types';
import { shouldSendPushForType } from './push.types';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async upsertPushToken(userId: string, token: string, platform: string) {
    const normalizedPlatform = platform.trim().toLowerCase() || 'unknown';
    const normalizedToken = token.trim();
    if (!normalizedToken) return { ok: false as const };

    await this.prisma.pushToken.deleteMany({
      where: { userId, platform: normalizedPlatform },
    });

    await this.prisma.pushToken.create({
      data: {
        userId,
        token: normalizedToken,
        platform: normalizedPlatform,
      },
    });

    return { ok: true as const };
  }

  async deletePushTokensForUser(userId: string) {
    await this.prisma.pushToken.deleteMany({ where: { userId } });
    return { ok: true as const };
  }

  async sendForNotification(record: PushNotificationRecord): Promise<void> {
    const expoToken = this.config.get<string>('EXPO_ACCESS_TOKEN')?.trim();
    if (!expoToken) {
      this.logger.debug('EXPO_ACCESS_TOKEN not set; skipping push delivery.');
      return;
    }

    const settings = await this.prisma.notificationSettings.findUnique({
      where: { userId: record.userId },
    });

    const prefs = {
      pushEnabled: settings?.pushEnabled ?? true,
      applicationUpdates: settings?.applicationUpdates ?? true,
      jobUpdates: settings?.jobUpdates ?? true,
      paymentUpdates: settings?.paymentUpdates ?? true,
      engagementUpdates: settings?.engagementUpdates ?? true,
      securityAlerts: settings?.securityAlerts ?? true,
      marketingUpdates: settings?.marketingUpdates ?? false,
    };

    if (!shouldSendPushForType(record.type, prefs)) {
      return;
    }

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: record.userId },
      select: { token: true },
    });

    const recipients = tokens.map((row) => row.token).filter(Boolean);
    if (!recipients.length) {
      return;
    }

    const dataPayload: Record<string, unknown> = {
      type: notificationApiType(record.type),
      notificationId: record.id,
    };
    if (record.relatedType) dataPayload.relatedType = record.relatedType;
    if (record.relatedId) dataPayload.relatedId = record.relatedId;

    const messages: ExpoPushMessage[] = recipients.map((to) => ({
      to,
      title: record.title,
      body: record.body ?? '',
      data: dataPayload,
      sound: 'default',
      priority: 'high',
    }));

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${expoToken}`,
        },
        body: JSON.stringify(messages),
      });

      const expoJson = (await response.json()) as ExpoPushResponse;
      if (!response.ok) {
        this.logger.warn(
          `Expo push HTTP ${response.status}: ${JSON.stringify(expoJson)}`,
        );
        return;
      }

      await this.pruneInvalidTokens(expoJson, recipients);
    } catch (error) {
      this.logger.warn(
        `Expo push request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async pruneInvalidTokens(
    expoJson: ExpoPushResponse,
    recipients: string[],
  ) {
    const tickets = expoJson.data ?? [];
    const staleTokens: string[] = [];

    tickets.forEach((ticket, index) => {
      if (ticket.status !== 'error') return;
      const code = ticket.details?.error ?? ticket.message;
      if (code === 'DeviceNotRegistered') {
        const token = recipients[index];
        if (token) staleTokens.push(token);
      }
    });

    if (!staleTokens.length) return;

    await this.prisma.pushToken.deleteMany({
      where: { token: { in: staleTokens } },
    });
  }
}
