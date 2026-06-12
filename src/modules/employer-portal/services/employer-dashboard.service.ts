import { Injectable } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import type { EmployerDashboardEntity } from '../entities/employer-dashboard.entity';
import { toEmployerJobListItem } from '../entities/employer-job.entity';
import { EmployerJobsRepository } from '../repositories/employer-jobs.repository';
import { EmployerContextService } from './employer-context.service';

@Injectable()
export class EmployerDashboardService {
  constructor(
    private readonly employerContext: EmployerContextService,
    private readonly employerJobsRepository: EmployerJobsRepository,
  ) {}

  async getDashboard(
    authUser: LocalAuthUser,
  ): Promise<EmployerDashboardEntity> {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);

    const [
      activeJobsCount,
      totalApplicants,
      hiredWorkers,
      totalPayrollAmount,
      liveJobsResult,
    ] = await Promise.all([
      this.employerJobsRepository.countActiveJobs(profile.id),
      this.employerJobsRepository.countApplicantsForEmployer(profile.id),
      this.employerJobsRepository.countHiredForEmployer(profile.id),
      this.employerJobsRepository.sumCompletedPayments(profile.id),
      this.employerJobsRepository.listForEmployer(profile.id, {
        status: JobStatus.ACTIVE,
        skip: 0,
        take: 10,
      }),
    ]);

    const countsMap =
      await this.employerJobsRepository.countApplicationsByJobIds(
        liveJobsResult.jobs.map((j) => j.id),
      );

    const payrollLabel =
      totalPayrollAmount >= 1_000_000
        ? `${(totalPayrollAmount / 1_000_000).toFixed(1)}M`
        : String(Math.round(totalPayrollAmount));

    return {
      activeJobs: {
        count: activeJobsCount,
        label: 'currently live',
      },
      totalApplicants: {
        count: totalApplicants,
        trend: 'all time',
      },
      hiredWorkers: {
        count: hiredWorkers,
        trend: 'hired via applications',
      },
      totalPayroll: {
        count: payrollLabel,
        trend: 'completed payments (XAF)',
      },
      liveJobs: liveJobsResult.jobs.map((job) =>
        toEmployerJobListItem(
          job,
          countsMap[job.id] ?? {
            applicationsCount: 0,
            shortlistedCount: 0,
          },
        ),
      ),
    };
  }
}
