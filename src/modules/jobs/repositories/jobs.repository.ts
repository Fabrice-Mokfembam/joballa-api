import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { JobStatus, Prisma, JobReportReason } from '@prisma/client';
import {
  JobSearchDto,
  ReportJobDto,
  CreateJobDto,
  UpdateJobDto,
  EmployerJobFilterDto,
} from '../dto/jobs.dto';
import {
  hasJobSearchFilters,
  sanitizeJobSearchDto,
} from '../utils/job-search-query.util';

// Fields returned on every job card in the listing
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
export class JobsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — JOB LISTING
  // ─────────────────────────────────────────────────────────────────────────

  async searchJobs(dto: JobSearchDto, workerId?: string) {
    const clean = sanitizeJobSearchDto(dto);
    let result: Awaited<ReturnType<JobsRepository['queryJobSearch']>> & {
      relaxedFilters?: boolean;
    } = await this.queryJobSearch(clean, workerId);

    // General browse: if filters matched nothing but live jobs exist, return the full feed.
    if (result.total === 0 && hasJobSearchFilters(clean)) {
      const browse = sanitizeJobSearchDto({
        page: clean.page,
        limit: clean.limit,
        sortBy: clean.sortBy,
        sortOrder: clean.sortOrder,
      });
      const fallback = await this.queryJobSearch(browse, workerId);
      if (fallback.total > 0) {
        result = { ...fallback, relaxedFilters: true };
      }
    }

    return result;
  }

  private async queryJobSearch(dto: JobSearchDto, workerId?: string) {
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    let hiddenJobIds: string[] = [];
    if (workerId) {
      const hidden = await this.prisma.hiddenJob.findMany({
        where: { workerId },
        select: { jobId: true },
      });
      hiddenJobIds = hidden.map((h) => h.jobId);
    }

    const where: Prisma.JobWhereInput = {
      status: JobStatus.ACTIVE,
      ...(hiddenJobIds.length && { id: { notIn: hiddenJobIds } }),
      ...(dto.keyword && {
        OR: [
          { title: { contains: dto.keyword, mode: 'insensitive' } },
          { description: { contains: dto.keyword, mode: 'insensitive' } },
          { category: { contains: dto.keyword, mode: 'insensitive' } },
        ],
      }),
      ...(dto.city && { city: { contains: dto.city, mode: 'insensitive' } }),
      ...(dto.category && {
        category: { contains: dto.category, mode: 'insensitive' },
      }),
      ...(dto.jobType && { jobType: dto.jobType }),
      ...(dto.workMode && { workMode: dto.workMode }),
      ...(dto.payStructure && { payStructure: dto.payStructure }),
      ...((dto.minPay !== undefined || dto.maxPay !== undefined) && {
        payRate: {
          ...(dto.minPay !== undefined && { gte: dto.minPay }),
          ...(dto.maxPay !== undefined && { lte: dto.maxPay }),
        },
      }),
    };

    const orderBy: Prisma.JobOrderByWithRelationInput =
      dto.sortBy === 'payRate'
        ? { payRate: dto.sortOrder ?? 'desc' }
        : { createdAt: dto.sortOrder ?? 'desc' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: JOB_CARD_SELECT,
      }),
      this.prisma.job.count({ where }),
    ]);

    let savedJobIds = new Set<string>();
    let appliedByJobId = new Map<string, string>();
    if (workerId) {
      const jobIds = items.map((j) => j.id);
      const [saved, applied] = await Promise.all([
        this.prisma.savedJob.findMany({
          where: { workerId, jobId: { in: jobIds } },
          select: { jobId: true },
        }),
        this.prisma.application.findMany({
          where: { workerId, jobId: { in: jobIds } },
          select: { jobId: true, id: true },
        }),
      ]);
      savedJobIds = new Set(saved.map((s) => s.jobId));
      appliedByJobId = new Map(applied.map((a) => [a.jobId, a.id]));
    }

    return {
      items,
      total,
      page,
      limit,
      savedJobIds,
      appliedByJobId,
    };
  }

  async getJobDetail(jobId: string) {
    return this.prisma.job.findUniqueOrThrow({
      where: { id: jobId, status: JobStatus.ACTIVE },
      include: {
        employer: {
          select: {
            id: true,
            companyName: true,
            industry: true,
            logoUrl: true,
            about: true,
            location: true,
            website: true,
            verificationStatus: true,
            isJoballaDepartment: true,
            departmentCategory: true,
          },
        },
        _count: { select: { applications: true } },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — SAVE / UNSAVE
  // ─────────────────────────────────────────────────────────────────────────

  async saveJob(workerId: string, jobId: string) {
    return this.prisma.savedJob.upsert({
      where: { workerId_jobId: { workerId, jobId } },
      create: { workerId, jobId },
      update: {}, // already saved — no-op
    });
  }

  async unsaveJob(workerId: string, jobId: string) {
    return this.prisma.savedJob.delete({
      where: { workerId_jobId: { workerId, jobId } },
    });
  }

  async getSavedJobs(workerId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.savedJob.findMany({
        where: { workerId },
        skip,
        take: limit,
        orderBy: { savedAt: 'desc' },
        include: { job: { select: JOB_CARD_SELECT } },
      }),
      this.prisma.savedJob.count({ where: { workerId } }),
    ]);

    return { items, total, page, limit };
  }

  async isJobSaved(workerId: string, jobId: string) {
    const saved = await this.prisma.savedJob.findUnique({
      where: { workerId_jobId: { workerId, jobId } },
    });
    return !!saved;
  }

  async getWorkerApplicationForJob(workerId: string, jobId: string) {
    return this.prisma.application.findUnique({
      where: { jobId_workerId: { jobId, workerId } },
      select: { id: true },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — HIDE / UNHIDE
  // ─────────────────────────────────────────────────────────────────────────

  async hideJob(workerId: string, jobId: string) {
    return this.prisma.hiddenJob.upsert({
      where: { workerId_jobId: { workerId, jobId } },
      create: { workerId, jobId },
      update: {},
    });
  }

  async unhideJob(workerId: string, jobId: string) {
    return this.prisma.hiddenJob.delete({
      where: { workerId_jobId: { workerId, jobId } },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — REPORT JOB
  // ─────────────────────────────────────────────────────────────────────────

  async reportJob(workerId: string, jobId: string, dto: ReportJobDto) {
    return this.prisma.jobReport.create({
      data: {
        workerId,
        jobId,
        reason: dto.reason as JobReportReason,
        description: dto.description,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EMPLOYER — JOB MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  async createJob(employerId: string, dto: CreateJobDto) {
    return this.prisma.job.create({
      data: {
        employerId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        jobType: dto.jobType,
        workMode: dto.workMode ?? 'ON_SITE',
        location: dto.location,
        city: dto.city,
        neighbourhood: dto.neighbourhood,
        payRate: dto.payRate,
        payStructure: dto.payStructure,
        currency: dto.currency ?? 'XAF',
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        startAsap: dto.startAsap ?? false,
        durationValue: dto.durationValue,
        durationUnit: dto.durationUnit,
        numberOfOpenings: dto.numberOfOpenings ?? 1,
        requiredSkills: dto.requiredSkills ?? [],
        requiredLevel: dto.requiredLevel,
        requirements: dto.requirements ?? [],
        responsibilities: dto.responsibilities ?? [],
        requestedDocuments: dto.requestedDocuments ?? [],
        status: JobStatus.UNDER_REVIEW, // always enters review queue
      },
    });
  }

  async getEmployerJobs(employerId: string, dto: EmployerJobFilterDto) {
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = {
      employerId,
      ...(dto.status && { status: dto.status as JobStatus }),
      ...(dto.keyword && {
        OR: [
          { title: { contains: dto.keyword, mode: 'insensitive' } },
          { category: { contains: dto.keyword, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          ...JOB_CARD_SELECT,
          _count: { select: { applications: true } },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getEmployerJobDetail(jobId: string, employerId: string) {
    return this.prisma.job.findUniqueOrThrow({
      where: { id: jobId, employerId },
      include: {
        _count: { select: { applications: true, engagements: true } },
      },
    });
  }

  async updateJob(jobId: string, employerId: string, dto: UpdateJobDto) {
    // Updating a live job re-enters review queue
    const current = await this.prisma.job.findUniqueOrThrow({
      where: { id: jobId, employerId },
      select: { status: true },
    });

    const backToReview =
      current.status === JobStatus.ACTIVE ||
      current.status === JobStatus.PAUSED;

    return this.prisma.job.update({
      where: { id: jobId, employerId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.category && { category: dto.category }),
        ...(dto.jobType && { jobType: dto.jobType }),
        ...(dto.workMode && { workMode: dto.workMode }),
        ...(dto.location && { location: dto.location }),
        ...(dto.city && { city: dto.city }),
        ...(dto.neighbourhood && { neighbourhood: dto.neighbourhood }),
        ...(dto.payRate && { payRate: dto.payRate }),
        ...(dto.payStructure && { payStructure: dto.payStructure }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        ...(dto.startAsap !== undefined && { startAsap: dto.startAsap }),
        ...(dto.durationValue && { durationValue: dto.durationValue }),
        ...(dto.durationUnit && { durationUnit: dto.durationUnit }),
        ...(dto.numberOfOpenings && { numberOfOpenings: dto.numberOfOpenings }),
        ...(dto.requiredSkills && { requiredSkills: dto.requiredSkills }),
        ...(dto.requiredLevel && { requiredLevel: dto.requiredLevel }),
        ...(dto.requirements && { requirements: dto.requirements }),
        ...(dto.responsibilities && { responsibilities: dto.responsibilities }),
        ...(dto.requestedDocuments && {
          requestedDocuments: dto.requestedDocuments,
        }),
        ...(backToReview && {
          status: JobStatus.UNDER_REVIEW,
          approvedById: null,
          approvedAt: null,
        }),
      },
    });
  }

  async updateJobStatus(jobId: string, employerId: string, status: JobStatus) {
    return this.prisma.job.update({
      where: { id: jobId, employerId },
      data: { status },
    });
  }

  async deleteJob(jobId: string, employerId: string) {
    // Hard delete only allowed on DRAFT or REJECTED jobs
    // All other statuses are closed instead to preserve application history
    const job = await this.prisma.job.findUniqueOrThrow({
      where: { id: jobId, employerId },
      select: { status: true },
    });

    if (job.status === JobStatus.DRAFT || job.status === JobStatus.REJECTED) {
      return this.prisma.job.delete({ where: { id: jobId } });
    }

    return this.prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.CLOSED },
    });
  }
}
