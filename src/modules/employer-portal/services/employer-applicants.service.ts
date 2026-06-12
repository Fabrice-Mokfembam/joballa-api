import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus, EngagementStatus, Prisma } from '@prisma/client';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import type { ListApplicantsQueryDto } from '../dto/list-applicants-query.dto';
import type { UpdateApplicantStatusDto } from '../dto/update-applicant-status.dto';
import type { UpdateApplicantNotesDto } from '../dto/update-applicant-notes.dto';
import {
  EmployerApplicantsRepository,
  type ApplicationWithRelations,
} from '../repositories/employer-applicants.repository';
import { EmployerWorkforceRepository } from '../repositories/employer-workforce.repository';
import {
  apiToApplicationStatus,
  applicationStatusToApi,
} from '../utils/application-status.util';
import {
  submittedProfileFromSnapshot,
  workerViewFromSnapshot,
} from '../utils/profile-snapshot.util';
import { EmployerContextService } from './employer-context.service';
import { toEmployerJobDetail } from '../entities/employer-job.entity';
import { EmployerJobsRepository } from '../repositories/employer-jobs.repository';

@Injectable()
export class EmployerApplicantsService {
  constructor(
    private readonly employerContext: EmployerContextService,
    private readonly applicantsRepository: EmployerApplicantsRepository,
    private readonly workforceRepository: EmployerWorkforceRepository,
    private readonly employerJobsRepository: EmployerJobsRepository,
    private readonly config: ConfigService,
  ) {}

  async list(authUser: LocalAuthUser, query: ListApplicantsQueryDto) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ApplicationWhereInput = {};

    if (query.jobId) {
      where.jobId = query.jobId;
    }

    if (query.status) {
      where.status = apiToApplicationStatus(query.status);
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { worker: { fullName: { contains: term, mode: 'insensitive' } } },
        { job: { title: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const orderBy: Prisma.ApplicationOrderByWithRelationInput =
      query.sort === 'oldest'
        ? { submittedAt: 'asc' }
        : { submittedAt: 'desc' };

    const { items, total } = await this.applicantsRepository.listForEmployer(
      profile.id,
      {
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      },
    );

    return {
      items: items.map((row) => this.toListItem(row)),
      total,
      page,
      limit,
    };
  }

  async filters(authUser: LocalAuthUser) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const jobTitles = await this.applicantsRepository.distinctJobTitles(
      profile.id,
    );
    return {
      jobTitles,
      statuses: ['pending', 'shortlisted', 'rejected', 'hired'],
    };
  }

  async getOne(authUser: LocalAuthUser, applicationId: string) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const row = await this.requireApplication(applicationId, profile.id);
    return this.toDetail(row, profile);
  }

  async updateNotes(
    authUser: LocalAuthUser,
    applicationId: string,
    dto: UpdateApplicantNotesDto,
  ) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    await this.requireApplication(applicationId, profile.id);
    const updated = await this.applicantsRepository.updateNotes(
      applicationId,
      dto.employerNotes,
    );
    return {
      applicationId: updated.id,
      employerNotes: updated.employerNotes,
    };
  }

  async updateStatus(
    authUser: LocalAuthUser,
    applicationId: string,
    dto: UpdateApplicantStatusDto,
  ) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const row = await this.requireApplication(applicationId, profile.id);
    const nextStatus = apiToApplicationStatus(dto.status);

    await this.applicantsRepository.updateStatus(applicationId, nextStatus);

    if (nextStatus === ApplicationStatus.HIRED) {
      await this.ensureEngagement(row, profile.id);
    }

    const updated = await this.requireApplication(applicationId, profile.id);
    return this.toDetail(updated, profile);
  }

  async shareLink(authUser: LocalAuthUser, applicationId: string) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    await this.requireApplication(applicationId, profile.id);

    const base =
      this.config.get<string>('PUBLIC_WEB_URL')?.trim() ||
      this.config.get<string>('WEB_APP_URL')?.trim() ||
      'https://joballa.com';
    const shareUrl = `${base.replace(/\/+$/, '')}/employer/applicants/${applicationId}`;
    return { shareUrl };
  }

  private async requireApplication(
    applicationId: string,
    employerProfileId: string,
  ) {
    const row = await this.applicantsRepository.findByIdForEmployer(
      applicationId,
      employerProfileId,
    );
    if (!row) {
      throw new NotFoundException('Application not found.');
    }
    return row;
  }

  private async ensureEngagement(
    application: ApplicationWithRelations,
    employerProfileId: string,
  ) {
    const existing = await this.workforceRepository.findEngagementForEmployer(
      application.workerId,
      employerProfileId,
    );
    if (existing) {
      return existing;
    }

    return this.workforceRepository.createEngagement({
      job: { connect: { id: application.jobId } },
      worker: { connect: { id: application.workerId } },
      employer: { connect: { id: employerProfileId } },
      application: { connect: { id: application.id } },
      startDate: new Date(),
      agreedRate: application.job.payRate,
      payStructure: application.job.payStructure,
      status: EngagementStatus.ACTIVE,
    });
  }

  private toListItem(row: ApplicationWithRelations) {
    const worker = workerViewFromSnapshot(row.workerId, row.profileSnapshot, {
      fullName: row.worker.fullName,
      city: row.worker.city,
      skills: row.worker.skills,
    });

    return {
      applicationId: row.id,
      appliedAt: row.submittedAt.toISOString(),
      matchPercent: row.matchPercent ?? 70,
      status: applicationStatusToApi(row.status),
      jobTitle: row.job.title,
      worker,
    };
  }

  private async toDetail(
    row: ApplicationWithRelations,
    profile: { id: string; companyName: string; logoUrl: string | null },
  ) {
    const countsMap =
      await this.employerJobsRepository.countApplicationsByJobIds([row.job.id]);
    const job = toEmployerJobDetail(
      row.job,
      profile as never,
      countsMap[row.job.id] ?? {
        applicationsCount: 0,
        shortlistedCount: 0,
      },
    );

    return {
      applicationId: row.id,
      appliedAt: row.submittedAt.toISOString(),
      matchPercent: row.matchPercent ?? 70,
      status: applicationStatusToApi(row.status),
      job,
      employerNotes: row.employerNotes,
      submittedProfile: submittedProfileFromSnapshot(
        row.workerId,
        row.profileSnapshot,
        {
          fullName: row.worker.fullName,
          city: row.worker.city,
          skills: row.worker.skills,
        },
      ),
      jobSpecificNote: row.jobSpecificNote,
    };
  }
}
