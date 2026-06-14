import {
  Injectable,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ApplicationsRepository } from '../repositories/applications.repository';
import { WorkersRepository } from '../../workers/repositories/workers.repository';
import {
  CustomizeProfileDto,
  SubmitApplicationDto,
  ApplicationFilterDto,
  UpdateApplicationStatusDto,
} from '../dto/applications.dto';
import { MIN_COMPLETENESS_TO_APPLY } from '../../workers/workers.constants';
import { Prisma, VerificationStatus } from '@prisma/client';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly workersRepository: WorkersRepository,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOMIZATION
  // ─────────────────────────────────────────────────────────────────────────

  async customizeProfile(
    workerId: string,
    jobId: string,
    dto: CustomizeProfileDto,
  ) {
    return this.applicationsRepository.upsertCustomization(
      workerId,
      jobId,
      dto,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMIT
  // ─────────────────────────────────────────────────────────────────────────

  async submitApplication(
    workerId: string,
    jobId: string,
    dto: SubmitApplicationDto,
  ) {
    // 1. Guard — completeness check
    const profile = await this.workersRepository.getFullProfile(workerId);

    if (profile.profileCompleteness < MIN_COMPLETENESS_TO_APPLY) {
      throw new ForbiddenException(
        `Profile completeness is ${profile.profileCompleteness}%. ` +
          `A minimum of ${MIN_COMPLETENESS_TO_APPLY}% is required to apply.`,
      );
    }

    if (profile.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException(
        'Identity verification (KYC) must be approved before applying to jobs.',
      );
    }

    // 2. Guard — duplicate application
    const alreadyApplied = await this.applicationsRepository.hasApplied(
      workerId,
      jobId,
    );

    if (alreadyApplied) {
      throw new ConflictException('You have already applied to this job');
    }

    // 3. Build profile snapshot — merge base profile with any customization
    const customization = await this.applicationsRepository.getCustomization(
      workerId,
      jobId,
    );

    const snapshot: Prisma.InputJsonValue = {
      workerId: profile.id,
      fullName: profile.fullName,
      professionalTitle: profile.professionalTitle,
      city: profile.city,
      country: profile.country,
      availabilityStatus: profile.availabilityStatus,
      verificationStatus: profile.verificationStatus,
      languagesSpoken: profile.languagesSpoken,
      // Customized fields override base profile if a draft exists
      bio: customization?.professionalSummary ?? profile.bio,
      skills: customization?.skills?.length
        ? customization.skills
        : profile.skills,
      workHistory: customization?.workHistoryIds?.length
        ? profile.workHistories.filter((w) =>
            customization.workHistoryIds.includes(w.id),
          )
        : profile.workHistories,
      education: profile.educations,
      certifications: profile.certifications,
      snapshotAt: new Date().toISOString(),
    };

    const application = await this.applicationsRepository.submitApplication(
      workerId,
      jobId,
      dto,
      snapshot,
    );

    this.logger.log(
      `Worker ${workerId} applied to job ${jobId} — application ${application.id}`,
    );

    return application;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — LIST & DETAIL
  // ─────────────────────────────────────────────────────────────────────────

  async getWorkerApplications(workerId: string, dto: ApplicationFilterDto) {
    return this.applicationsRepository.getWorkerApplications(workerId, dto);
  }

  async getWorkerApplicationDetail(applicationId: string, workerId: string) {
    return this.applicationsRepository.getWorkerApplicationDetail(
      applicationId,
      workerId,
    );
  }

  async archiveApplication(applicationId: string, workerId: string) {
    return this.applicationsRepository.archiveApplication(
      applicationId,
      workerId,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EMPLOYER — APPLICANT REVIEW
  // ─────────────────────────────────────────────────────────────────────────

  async getJobApplicants(
    jobId: string,
    employerId: string,
    status?: string,
    page = 1,
    limit = 20,
  ) {
    return this.applicationsRepository.getJobApplicants(
      jobId,
      employerId,
      status,
      page,
      limit,
    );
  }

  async updateApplicationStatus(
    applicationId: string,
    employerId: string,
    dto: UpdateApplicationStatusDto,
  ) {
    const updated = await this.applicationsRepository.updateApplicationStatus(
      applicationId,
      employerId,
      dto,
    );

    this.logger.log(
      `Application ${applicationId} updated to ${dto.status} by employer ${employerId}`,
    );

    // TODO: notify worker of status change once NotificationService is wired
    return updated;
  }
}
