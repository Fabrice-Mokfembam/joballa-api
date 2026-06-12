import { Module } from '@nestjs/common';
import { WorkersController } from './controllers/workers.controller';
import { WorkersService } from './services/workers.service';
import { WorkersRepository } from './repositories/workers.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { FilesModule } from '../files/files.module';
import { WorkerDashboardController } from './controllers/worker-dashboard.controller';
import { WorkerJobsController } from './controllers/worker-jobs.controller';
import { WorkerNotificationsController } from './controllers/worker-notifications.controller';
import { WorkerDashboardService } from './services/worker-dashboard.service';
import { WorkerJobsService } from './services/worker-jobs.service';
import { WorkerNotificationsService } from './services/worker-notifications.service';

/**
 * WorkersModule
 *
 * Covers all worker profile operations:
 *   - /api/worker/me
 *   - /api/worker/profile (personal info, summary, skills, avatar)
 *   - /api/worker/profile/work-history
 *   - /api/worker/profile/education
 *   - /api/worker/profile/certifications
 *   - /api/worker/profile/documents
 *   - /api/worker/profile/kyc
 *   - /api/worker/profile/payment-details
 *
 * Exports WorkersService so ApplicationsModule can call
 * assertCanApply() before allowing a job application.
 */
@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [
    WorkersController,
    WorkerDashboardController,
    WorkerJobsController,
    WorkerNotificationsController,
  ],
  providers: [
    WorkersService,
    WorkersRepository,
    WorkerDashboardService,
    WorkerJobsService,
    WorkerNotificationsService,
  ],
  exports: [WorkersService],
})
export class WorkersModule {}
