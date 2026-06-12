import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  JobStatus,
  Prisma,
  type EmployerProfile,
  type Job,
} from '@prisma/client';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import type { CreateEmployerJobDto } from '../dto/create-employer-job.dto';
import type { ListEmployerJobsQueryDto } from '../dto/list-employer-jobs-query.dto';
import type { UpdateEmployerJobDto } from '../dto/update-employer-job.dto';
import type { UpdateJobStatusDto } from '../dto/update-job-status.dto';
import {
  toEmployerJobDetail,
  toEmployerJobListItem,
  type EmployerJobDetailEntity,
} from '../entities/employer-job.entity';
import { EmployerJobsRepository } from '../repositories/employer-jobs.repository';
import {
  apiStatusToJobStatus,
  jobStatusToApi,
} from '../utils/employer-job-status.util';
import {
  parseEmploymentType,
  parsePayPer,
} from '../utils/employer-job-type.util';
import { EmployerContextService } from './employer-context.service';

@Injectable()
export class EmployerJobsService {
  constructor(
    private readonly employerContext: EmployerContextService,
    private readonly employerJobsRepository: EmployerJobsRepository,
  ) {}

  async create(
    authUser: LocalAuthUser,
    dto: CreateEmployerJobDto,
  ): Promise<{ jobId: string; status: string; message: string }> {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);

    const data = this.buildJobCreateInput(profile.id, dto);
    const status = dto.asDraft ? JobStatus.DRAFT : JobStatus.UNDER_REVIEW;
    const job = await this.employerJobsRepository.create({
      ...data,
      status,
    });

    return {
      jobId: job.id,
      status: jobStatusToApi(job.status),
      message: dto.asDraft
        ? 'Job saved as draft.'
        : 'Job submitted. Joballa admin will review before going live.',
    };
  }

  async saveDraft(
    authUser: LocalAuthUser,
    jobId: string,
    dto: CreateEmployerJobDto | UpdateEmployerJobDto,
  ): Promise<EmployerJobDetailEntity> {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const existing = await this.requireOwnedJob(jobId, profile.id);

    const updateData = this.buildJobUpdateInput(dto);
    const job = await this.employerJobsRepository.update(jobId, {
      ...updateData,
      status: JobStatus.DRAFT,
    });

    return this.toDetail(job, profile);
  }

  async list(
    authUser: LocalAuthUser,
    query: ListEmployerJobsQueryDto,
  ): Promise<{
    items: ReturnType<typeof toEmployerJobListItem>[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    let statusFilter: JobStatus | undefined;

    if (query.status) {
      const mapped = apiStatusToJobStatus(query.status);
      if (mapped === 'all' || mapped === undefined) {
        if (mapped === undefined && query.status.trim()) {
          throw new BadRequestException(`Unknown job status: ${query.status}`);
        }
      } else {
        statusFilter = mapped;
      }
    }

    const { jobs, total } = await this.employerJobsRepository.listForEmployer(
      profile.id,
      {
        status: statusFilter,
        skip: (page - 1) * limit,
        take: limit,
      },
    );

    const countsMap =
      await this.employerJobsRepository.countApplicationsByJobIds(
        jobs.map((j) => j.id),
      );

    return {
      items: jobs.map((job) =>
        toEmployerJobListItem(
          job,
          countsMap[job.id] ?? {
            applicationsCount: 0,
            shortlistedCount: 0,
          },
        ),
      ),
      total,
      page,
      limit,
    };
  }

  async getOne(
    authUser: LocalAuthUser,
    jobId: string,
  ): Promise<EmployerJobDetailEntity> {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const job = await this.requireOwnedJob(jobId, profile.id);
    return this.toDetail(job, profile);
  }

  async update(
    authUser: LocalAuthUser,
    jobId: string,
    dto: UpdateEmployerJobDto,
  ): Promise<EmployerJobDetailEntity> {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    await this.requireOwnedJob(jobId, profile.id);

    const job = await this.employerJobsRepository.update(
      jobId,
      this.buildJobUpdateInput(dto),
    );
    return this.toDetail(job, profile);
  }

  async updateStatus(
    authUser: LocalAuthUser,
    jobId: string,
    dto: UpdateJobStatusDto,
  ): Promise<EmployerJobDetailEntity> {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    await this.requireOwnedJob(jobId, profile.id);

    const mapped = apiStatusToJobStatus(dto.status);
    if (!mapped || mapped === 'all') {
      throw new BadRequestException(`Invalid status: ${dto.status}`);
    }

    if (mapped === JobStatus.UNDER_REVIEW) {
      throw new BadRequestException(
        'Use POST /api/employer/jobs to submit a job for review.',
      );
    }

    const job = await this.employerJobsRepository.update(jobId, {
      status: mapped,
    });
    return this.toDetail(job, profile);
  }

  async remove(authUser: LocalAuthUser, jobId: string): Promise<void> {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const job = await this.requireOwnedJob(jobId, profile.id);

    if (job.status === JobStatus.DRAFT || job.status === JobStatus.REJECTED) {
      await this.employerJobsRepository.delete(jobId);
      return;
    }

    if (job.status === JobStatus.CLOSED) {
      throw new BadRequestException('Job is already closed.');
    }

    await this.employerJobsRepository.update(jobId, {
      status: JobStatus.CLOSED,
    });
  }

  private async requireOwnedJob(jobId: string, employerProfileId: string) {
    const job = await this.employerJobsRepository.findByIdForEmployer(
      jobId,
      employerProfileId,
    );
    if (!job) {
      throw new NotFoundException('Job not found.');
    }
    return job;
  }

  private async toDetail(
    job: Job,
    profile: EmployerProfile,
  ): Promise<EmployerJobDetailEntity> {
    const countsMap =
      await this.employerJobsRepository.countApplicationsByJobIds([job.id]);
    return toEmployerJobDetail(
      job,
      profile,
      countsMap[job.id] ?? {
        applicationsCount: 0,
        shortlistedCount: 0,
      },
    );
  }

  private buildJobCreateInput(
    employerProfileId: string,
    dto: CreateEmployerJobDto,
  ): Prisma.JobCreateInput {
    const jobType = dto.jobType ?? parseEmploymentType(dto.employmentType);
    const payStructure = dto.payStructure ?? parsePayPer(dto.per);
    const location = this.formatLocation(dto.city, dto.neighbourhood);

    return {
      employer: { connect: { id: employerProfileId } },
      title: dto.title,
      description: dto.description,
      category: dto.category?.trim() || 'General',
      jobType,
      location,
      city: dto.city,
      neighbourhood: dto.neighbourhood ?? null,
      payRate: dto.pay,
      payStructure,
      currency: dto.currency?.trim() || 'XAF',
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      startAsap: dto.startAsap ?? false,
      durationValue: dto.durationValue ?? null,
      durationUnit: dto.durationUnit ?? null,
      numberOfOpenings: dto.numberOfOpenings,
      requiredSkills: dto.requiredSkills,
      requiredLevel: dto.requiredLevel ?? null,
      requirements: dto.requirements ?? [],
      responsibilities: dto.responsibilities ?? [],
      requestedDocuments: [],
    };
  }

  private buildJobUpdateInput(
    dto: CreateEmployerJobDto | UpdateEmployerJobDto,
  ): Prisma.JobUpdateInput {
    const data: Prisma.JobUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.employmentType !== undefined) {
      data.jobType = parseEmploymentType(dto.employmentType);
    }
    if (dto.city !== undefined || dto.neighbourhood !== undefined) {
      const city = dto.city;
      const neighbourhood = dto.neighbourhood;
      if (city !== undefined) data.city = city;
      if (neighbourhood !== undefined) data.neighbourhood = neighbourhood;
      if (city !== undefined) {
        data.location = this.formatLocation(city, neighbourhood ?? undefined);
      }
    }
    if (dto.pay !== undefined) data.payRate = dto.pay;
    if (dto.per !== undefined) data.payStructure = parsePayPer(dto.per);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.startDate !== undefined) {
      data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }
    if (dto.startAsap !== undefined) data.startAsap = dto.startAsap;
    if (dto.durationValue !== undefined) data.durationValue = dto.durationValue;
    if (dto.durationUnit !== undefined) data.durationUnit = dto.durationUnit;
    if (dto.numberOfOpenings !== undefined) {
      data.numberOfOpenings = dto.numberOfOpenings;
    }
    if (dto.requiredSkills !== undefined)
      data.requiredSkills = dto.requiredSkills;
    if (dto.requiredLevel !== undefined) data.requiredLevel = dto.requiredLevel;
    if (dto.requirements !== undefined) data.requirements = dto.requirements;
    if (dto.responsibilities !== undefined) {
      data.responsibilities = dto.responsibilities;
    }

    return data;
  }

  private formatLocation(city: string, neighbourhood?: string): string {
    if (neighbourhood?.trim()) {
      return `${city}, ${neighbourhood.trim()}`;
    }
    return city;
  }
}
