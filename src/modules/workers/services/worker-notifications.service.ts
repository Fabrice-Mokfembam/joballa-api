import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { WorkerNotificationSettingsDto } from '../dto/workers.dto';

const DEFAULT_SETTINGS = {
  pushEnabled: true,
  emailEnabled: true,
  jobsEnabled: true,
  messagesEnabled: false,
};

@Injectable()
export class WorkerNotificationsService {
  private readonly settingsByUser = new Map<string, typeof DEFAULT_SETTINGS>();

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, filter: string = 'all', page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Prisma.NotificationWhereInput = {
      userId,
      channel: NotificationChannel.IN_APP,
      ...(filter === 'jobs' && {
        type: {
          in: [
            NotificationType.APPLICATION_RECEIVED,
            NotificationType.APPLICATION_SHORTLISTED,
            NotificationType.APPLICATION_HIRED,
            NotificationType.APPLICATION_REJECTED,
            NotificationType.JOB_APPROVED,
            NotificationType.JOB_REJECTED,
          ],
        },
      }),
      ...(filter === 'payments' && {
        type: {
          in: [
            NotificationType.PAYMENT_SENT,
            NotificationType.PAYMENT_RECEIVED,
          ],
        },
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.message,
        read: n.read,
        createdAt: n.sentAt.toISOString(),
        deepLink:
          (n.metadata as { deepLink?: string } | null)?.deepLink ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  async markRead(userId: string, notificationId: string) {
    const row = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
    if (!row.count) {
      throw new NotFoundException('Notification not found');
    }
    const updated = await this.prisma.notification.findUniqueOrThrow({
      where: { id: notificationId },
    });
    return {
      id: updated.id,
      type: updated.type,
      title: updated.title,
      body: updated.message,
      read: updated.read,
      createdAt: updated.sentAt.toISOString(),
    };
  }

  getSettings(userId: string) {
    return this.settingsByUser.get(userId) ?? { ...DEFAULT_SETTINGS };
  }

  saveSettings(userId: string, dto: WorkerNotificationSettingsDto) {
    const current = this.getSettings(userId);
    const saved = { ...current, ...dto };
    this.settingsByUser.set(userId, saved);
    return saved;
  }
}
