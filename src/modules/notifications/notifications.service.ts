import { Injectable } from '@nestjs/common';
import type { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from './push.service';

export type WorkerNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedType?: string;
  relatedId?: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  async emitWorkerNotification(input: WorkerNotificationInput) {
    const settings = await this.prisma.notificationSettings.findUnique({
      where: { userId: input.userId },
    });
    if (settings && !settings.inAppEnabled) return null;

    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        relatedType: input.relatedType,
        relatedId: input.relatedId,
      },
    });

    void this.pushService.sendForNotification(row);
    return row;
  }
}
