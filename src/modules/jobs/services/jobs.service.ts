import {
  Injectable,
  BadRequestException,
  //   ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JobsRepository } from '../repositories/jobs.repository';
import {
  JobSearchDto,
  ReportJobDto,
  CreateJobDto,
  UpdateJobDto,
  EmployerJobFilterDto,
} from '../dto/jobs.dto';
import { JobStatus } from '@prisma/client';
import { mapJobCard } from '../utils/job-card.mapper';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly jobsRepository: JobsRepository) {}

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — BROWSING
  // ─────────────────────────────────────────────────────────────────────────

  async searchJobs(dto: JobSearchDto, workerId?: string) {
    const result = await this.jobsRepository.searchJobs(dto, workerId);
    const { savedJobIds, appliedByJobId, items, ...meta } = result;
    return {
      ...meta,
      items: items.map((job) =>
        mapJobCard(job, { savedJobIds, appliedByJobId }),
      ),
    };
  }

  async getJobDetail(jobId: string, workerId?: string) {
    const job = await this.jobsRepository.getJobDetail(jobId);
    let ctx:
      | { savedJobIds?: Set<string>; appliedByJobId?: Map<string, string> }
      | undefined;
    if (workerId) {
      const [saved, applied] = await Promise.all([
        this.jobsRepository.isJobSaved(workerId, jobId),
        this.jobsRepository.getWorkerApplicationForJob(workerId, jobId),
      ]);
      ctx = {
        savedJobIds: saved ? new Set([jobId]) : new Set(),
        appliedByJobId: applied ? new Map([[jobId, applied.id]]) : new Map(),
      };
    }
    return mapJobCard(
      {
        ...job,
        description: job.description,
        region: job.region,
        neighbourhood: job.neighbourhood,
        durationValue: job.durationValue,
        durationUnit: job.durationUnit,
        _count: job._count,
      },
      ctx,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — SAVE / UNSAVE
  // ─────────────────────────────────────────────────────────────────────────

  async saveJob(workerId: string, jobId: string) {
    return this.jobsRepository.saveJob(workerId, jobId);
  }

  async unsaveJob(workerId: string, jobId: string) {
    return this.jobsRepository.unsaveJob(workerId, jobId);
  }

  async getSavedJobs(workerId: string, page = 1, limit = 20) {
    return this.jobsRepository.getSavedJobs(workerId, page, limit);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — HIDE / UNHIDE
  // ─────────────────────────────────────────────────────────────────────────

  async hideJob(workerId: string, jobId: string) {
    return this.jobsRepository.hideJob(workerId, jobId);
  }

  async unhideJob(workerId: string, jobId: string) {
    return this.jobsRepository.unhideJob(workerId, jobId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — REPORT
  // ─────────────────────────────────────────────────────────────────────────

  async reportJob(workerId: string, jobId: string, dto: ReportJobDto) {
    const result = await this.jobsRepository.reportJob(workerId, jobId, dto);
    this.logger.log(
      `Job ${jobId} reported by worker ${workerId}: ${dto.reason}`,
    );
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — SHARE (generate shareable link — no DB call needed)
  // ─────────────────────────────────────────────────────────────────────────

  getShareableLink(jobId: string): { url: string } {
    // Frontend deep-link pattern — adjust base URL for production
    return { url: `https://joballa.com/jobs/${jobId}` };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EMPLOYER — JOB MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  async createJob(employerId: string, dto: CreateJobDto) {
    const job = await this.jobsRepository.createJob(employerId, dto);
    this.logger.log(
      `Employer ${employerId} created job ${job.id} — entered review queue`,
    );
    return job;
  }

  async getEmployerJobs(employerId: string, dto: EmployerJobFilterDto) {
    return this.jobsRepository.getEmployerJobs(employerId, dto);
  }

  async getEmployerJobDetail(jobId: string, employerId: string) {
    return this.jobsRepository.getEmployerJobDetail(jobId, employerId);
  }

  async updateJob(jobId: string, employerId: string, dto: UpdateJobDto) {
    const job = await this.jobsRepository.updateJob(jobId, employerId, dto);
    this.logger.log(`Employer ${employerId} updated job ${jobId}`);
    return job;
  }

  async updateJobStatus(jobId: string, employerId: string, status: string) {
    const allowedTransitions: Record<string, JobStatus[]> = {
      PAUSED: [JobStatus.ACTIVE],
      ACTIVE: [JobStatus.PAUSED],
      CLOSED: [JobStatus.ACTIVE, JobStatus.PAUSED],
    };

    const current = await this.jobsRepository.getEmployerJobDetail(
      jobId,
      employerId,
    );

    const allowed = allowedTransitions[status as JobStatus] ?? [];

    if (!allowed.includes(current.status)) {
      throw new BadRequestException(
        `Cannot transition job from ${current.status} to ${status}`,
      );
    }

    return this.jobsRepository.updateJobStatus(
      jobId,
      employerId,
      status as JobStatus,
    );
  }

  async deleteJob(jobId: string, employerId: string) {
    return this.jobsRepository.deleteJob(jobId, employerId);
  }
}
