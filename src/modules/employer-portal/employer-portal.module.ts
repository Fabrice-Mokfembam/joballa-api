import { Module } from '@nestjs/common';
import { EmployerProfilesModule } from '../employer-profiles/employer-profiles.module';
import { FilesModule } from '../files/files.module';
import { UsersModule } from '../users/users.module';
import { EmployerPortalController } from './controllers/employer-portal.controller';
import { EmployerApplicantsRepository } from './repositories/employer-applicants.repository';
import { EmployerJobsRepository } from './repositories/employer-jobs.repository';
import { EmployerPaymentsRepository } from './repositories/employer-payments.repository';
import { EmployerWorkforceRepository } from './repositories/employer-workforce.repository';
import { EmployerApplicantsService } from './services/employer-applicants.service';
import { EmployerCompanyService } from './services/employer-company.service';
import { EmployerContextService } from './services/employer-context.service';
import { EmployerDashboardService } from './services/employer-dashboard.service';
import { EmployerJobsService } from './services/employer-jobs.service';
import { EmployerMeService } from './services/employer-me.service';
import { EmployerPaymentsService } from './services/employer-payments.service';
import { EmployerWorkforceService } from './services/employer-workforce.service';
import { EmployerNotificationsService } from './services/employer-notifications.service';

@Module({
  imports: [UsersModule, EmployerProfilesModule, FilesModule],
  controllers: [EmployerPortalController],
  providers: [
    EmployerContextService,
    EmployerMeService,
    EmployerDashboardService,
    EmployerJobsService,
    EmployerApplicantsService,
    EmployerWorkforceService,
    EmployerPaymentsService,
    EmployerCompanyService,
    EmployerNotificationsService,
    EmployerJobsRepository,
    EmployerApplicantsRepository,
    EmployerWorkforceRepository,
    EmployerPaymentsRepository,
  ],
})
export class EmployerPortalModule {}
