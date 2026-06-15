import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

@Module({
  imports: [PrismaModule],
  providers: [PushService, NotificationsService],
  exports: [PushService, NotificationsService],
})
export class NotificationsModule {}
