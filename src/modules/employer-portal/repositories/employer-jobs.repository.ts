import { Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  JobStatus,
  PaymentStatus,
  Prisma,
  type Job,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { EmployerJobCounts } from '../entities/employer-job.entity';

@Injectable()
export class EmployerJobsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.JobCreateInput): Promise<Job> {
    return this.prisma.job.create({ data });
  }

  update(id: string, data: Prisma.JobUpdateInput): Promise<Job> {
    return this.prisma.job.update({ where: { id }, data });
  }

  delete(id: string): Promise<Job> {
    return this.prisma.job.delete({ where: { id } });
  }

  findByIdForEmployer(
    jobId: string,
    employerProfileId: string,
  ): Promise<Job | null> {
    return this.prisma.job.findFirst({
      where: { id: jobId, employerId: employerProfileId },
    });
  }

  listForEmployer(
    employerProfileId: string,
    params: {
      status?: JobStatus;
      skip: number;
      take: number;
    },
  ): Promise<{ jobs: Job[]; total: number }> {
    const where: Prisma.JobWhereInput = {
      employerId: employerProfileId,
      ...(params.status ? { status: params.status } : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      const [jobs, total] = await Promise.all([
        tx.job.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: params.skip,
          take: params.take,
        }),
        tx.job.count({ where }),
      ]);
      return { jobs, total };
    });
  }

  async countApplicationsByJobIds(
    jobIds: string[],
  ): Promise<Record<string, EmployerJobCounts>> {
    if (jobIds.length === 0) {
      return {};
    }

    const grouped = await this.prisma.application.groupBy({
      by: ['jobId', 'status'],
      where: { jobId: { in: jobIds } },
      _count: { _all: true },
    });

    const map: Record<string, EmployerJobCounts> = {};
    for (const id of jobIds) {
      map[id] = { applicationsCount: 0, shortlistedCount: 0 };
    }

    for (const row of grouped) {
      const entry = map[row.jobId] ?? {
        applicationsCount: 0,
        shortlistedCount: 0,
      };
      entry.applicationsCount += row._count._all;
      if (row.status === ApplicationStatus.SHORTLISTED) {
        entry.shortlistedCount += row._count._all;
      }
      map[row.jobId] = entry;
    }

    return map;
  }

  countActiveJobs(employerProfileId: string): Promise<number> {
    return this.prisma.job.count({
      where: {
        employerId: employerProfileId,
        status: JobStatus.ACTIVE,
      },
    });
  }

  countApplicantsForEmployer(employerProfileId: string): Promise<number> {
    return this.prisma.application.count({
      where: { job: { employerId: employerProfileId } },
    });
  }

  countHiredForEmployer(employerProfileId: string): Promise<number> {
    return this.prisma.application.count({
      where: {
        job: { employerId: employerProfileId },
        status: ApplicationStatus.HIRED,
      },
    });
  }

  sumCompletedPayments(employerProfileId: string): Promise<number> {
    return this.prisma.payment
      .aggregate({
        where: {
          employerId: employerProfileId,
          status: PaymentStatus.COMPLETED,
        },
        _sum: { amount: true },
      })
      .then((r) => Number(r._sum.amount ?? 0));
  }
}
