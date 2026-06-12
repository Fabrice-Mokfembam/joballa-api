import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

const DEFAULT_SETTINGS = {
  pushEnabled: true,
  emailEnabled: true,
  applicantsEnabled: true,
  messagesEnabled: false,
};

@Injectable()
export class EmployerNotificationsService {
  private readonly settingsByUser = new Map<string, typeof DEFAULT_SETTINGS>();

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, filter = 'all', page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Prisma.NotificationWhereInput = {
      userId,
      channel: NotificationChannel.IN_APP,
      ...(filter === 'applicants' && {
        type: {
          in: [
            NotificationType.APPLICATION_RECEIVED,
            NotificationType.APPLICATION_SHORTLISTED,
            NotificationType.APPLICATION_HIRED,
            NotificationType.APPLICATION_REJECTED,
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

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, channel: NotificationChannel.IN_APP, read: false },
    });
    return { count };
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

  saveSettings(userId: string, dto: Partial<typeof DEFAULT_SETTINGS>) {
    const saved = { ...this.getSettings(userId), ...dto };
    this.settingsByUser.set(userId, saved);
    return saved;
  }
}
