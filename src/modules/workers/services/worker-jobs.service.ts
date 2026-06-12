import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ApplicationStatus,
  JobCreatedByType,
  JobStatus,
  Prisma,
} from '@prisma/client';
import {
  WorkerCreateJobDto,
  WorkerJobFilterDto,
  WorkerIncomingApplicationsDto,
  WorkerJobStatusDto,
  WorkerUpdateJobDto,
} from '../dto/worker-jobs.dto';
import { WorkersService } from './workers.service';
import { mapJobCard } from '../../jobs/utils/job-card.mapper';

const JOB_CARD_SELECT = {
  id: true,
  title: true,
  description: true,
  category: true,
  jobType: true,
  workMode: true,
  location: true,
  city: true,
  region: true,
  neighbourhood: true,
  payRate: true,
  payStructure: true,
  currency: true,
  numberOfOpenings: true,
  requiredSkills: true,
  requiredLevel: true,
  startAsap: true,
  startDate: true,
  durationValue: true,
  durationUnit: true,
  status: true,
  createdAt: true,
  employer: {
    select: {
      id: true,
      companyName: true,
      logoUrl: true,
      isJoballaDepartment: true,
      verificationStatus: true,
    },
  },
  _count: { select: { applications: true } },
} as const;

@Injectable()
export class WorkerJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workersService: WorkersService,
  ) {}

  async createJob(userId: string, dto: WorkerCreateJobDto) {
    const workerId = await this.workersService.assertKycVerified(userId);
    const employer = await this.prisma.employerProfile.findFirst({
      where: { isJoballaDepartment: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!employer) {
      throw new BadRequestException(
        'Worker job posting is not configured (no platform employer profile).',
      );
    }

    const location =
      [dto.neighbourhood, dto.city, dto.region].filter(Boolean).join(', ') ||
      dto.city;

    const job = await this.prisma.job.create({
      data: {
        employerId: employer.id,
        createdByWorkerId: workerId,
        createdByType: JobCreatedByType.WORKER,
        title: dto.title,
        description: dto.description,
        category: dto.category ?? 'General',
        jobType: dto.jobType,
        workMode: 'ON_SITE',
        location,
        city: dto.city,
        region: dto.region,
        neighbourhood: dto.neighbourhood,
        payRate: dto.payRate,
        payStructure: dto.payStructure,
        currency: dto.currency ?? 'XAF',
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        startAsap: dto.startAsap ?? false,
        durationValue: dto.durationValue,
        durationUnit: dto.durationUnit,
        numberOfOpenings: dto.numberOfOpenings ?? 1,
        requiredSkills: dto.requiredSkills ?? [],
        requiredLevel: dto.requiredLevel,
        requirements: dto.requirements ?? [],
        responsibilities: dto.responsibilities ?? [],
        status: dto.asDraft ? JobStatus.DRAFT : JobStatus.UNDER_REVIEW,
      },
      select: JOB_CARD_SELECT,
    });

    return mapJobCard(job);
  }

  async listMyJobs(userId: string, dto: WorkerJobFilterDto) {
    const workerId = await this.workersService.getWorkerProfileId(userId);
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = {
      createdByWorkerId: workerId,
      ...(dto.status && { status: dto.status }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: JOB_CARD_SELECT,
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      items: items.map((j) => mapJobCard(j)),
      total,
      page,
      limit,
    };
  }

  async getJob(userId: string, jobId: string) {
    const workerId = await this.workersService.getWorkerProfileId(userId);
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, createdByWorkerId: workerId },
      select: JOB_CARD_SELECT,
    });
    if (!job) throw new NotFoundException('Job not found');
    return mapJobCard(job);
  }

  async updateJob(userId: string, jobId: string, dto: WorkerUpdateJobDto) {
    await this.assertOwnsJob(userId, jobId);
    const job = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.city && { city: dto.city }),
        ...(dto.requiredSkills && { requiredSkills: dto.requiredSkills }),
        ...(dto.payRate !== undefined && { payRate: dto.payRate }),
        ...(dto.asDraft === true && { status: JobStatus.DRAFT }),
      },
      select: JOB_CARD_SELECT,
    });
    return mapJobCard(job);
  }

  async updateJobStatus(
    userId: string,
    jobId: string,
    dto: WorkerJobStatusDto,
  ) {
    await this.assertOwnsJob(userId, jobId);
    const job = await this.prisma.job.update({
      where: { id: jobId },
      data: { status: dto.status },
      select: JOB_CARD_SELECT,
    });
    return mapJobCard(job);
  }

  async deleteJob(userId: string, jobId: string) {
    await this.assertOwnsJob(userId, jobId);
    await this.prisma.job.delete({ where: { id: jobId } });
  }

  async listIncomingApplications(
    userId: string,
    dto: WorkerIncomingApplicationsDto,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(userId);
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const statusFilter = dto.status;

    const where: Prisma.ApplicationWhereInput = {
      job: { createdByWorkerId: workerId },
      ...(dto.jobId && { jobId: dto.jobId }),
      ...(statusFilter && { status: statusFilter }),
      ...(dto.keyword && {
        OR: [
          {
            job: {
              title: { contains: dto.keyword, mode: 'insensitive' },
            },
          },
          {
            worker: {
              fullName: { contains: dto.keyword, mode: 'insensitive' },
            },
          },
        ],
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              payRate: true,
              currency: true,
              payStructure: true,
              jobType: true,
              city: true,
              region: true,
            },
          },
          worker: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      items: rows.map((a) => ({
        id: a.id,
        applicationId: a.id,
        status: a.status,
        appliedAt: a.submittedAt.toISOString(),
        jobId: a.jobId,
        jobTitle: a.job.title,
        applicantName: a.worker.fullName,
        applicantAvatarUrl: a.worker.avatarUrl,
        workerId: a.worker.id,
        payRate: Number(a.job.payRate),
        currency: a.job.currency,
        payStructure: a.job.payStructure,
        jobType: a.job.jobType,
        city: a.job.city,
        region: a.job.region,
        matchPercent: a.matchPercent,
        profileSnapshot: a.profileSnapshot,
      })),
      total,
      page,
      limit,
    };
  }

  async getIncomingApplication(userId: string, applicationId: string) {
    const workerId = await this.workersService.getWorkerProfileId(userId);
    const row = await this.prisma.application.findFirst({
      where: {
        id: applicationId,
        job: { createdByWorkerId: workerId },
      },
      include: {
        job: { select: JOB_CARD_SELECT },
        worker: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            professionalTitle: true,
            city: true,
            skills: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Application not found');

    return {
      id: row.id,
      status: row.status,
      appliedAt: row.submittedAt.toISOString(),
      profileSnapshot: row.profileSnapshot,
      job: mapJobCard(row.job),
      applicant: row.worker,
    };
  }

  private async assertOwnsJob(userId: string, jobId: string) {
    const workerId = await this.workersService.getWorkerProfileId(userId);
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, createdByWorkerId: workerId },
      select: { id: true },
    });
    if (!job) {
      throw new ForbiddenException('You can only manage jobs you created');
    }
  }
}
