import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { FilesModule } from '../../files/files.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { WorkerV2Controller } from './worker-v2.controller';
import { WorkerCvExportService } from './worker-cv-export.service';
import { WorkerV2Service } from './worker-v2.service';

@Module({
  imports: [PrismaModule, FilesModule, NotificationsModule],
  controllers: [WorkerV2Controller],
  providers: [WorkerV2Service, WorkerCvExportService],
})
export class WorkerV2Module {}
