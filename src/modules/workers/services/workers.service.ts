import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { WorkersRepository } from '../repositories/workers.repository';
import {
  UpdatePersonalInfoDto,
  UpdateProfessionalSummaryDto,
  UpdateSkillsDto,
  CreateWorkHistoryDto,
  UpdateWorkHistoryDto,
  CreateEducationDto,
  UpdateEducationDto,
  CreateCertificationDto,
  UpdateCertificationDto,
  UpdatePaymentDetailsDto,
  SubmitKYCDto,
  UpsertWorkerProfileDto,
  CreatePaymentAccountDto,
  UpdatePaymentAccountDto,
} from '../dto/workers.dto';
import { MIN_COMPLETENESS_TO_APPLY } from '../workers.constants';
import type { WorkerProfileResponseEntity } from '../entities/worker-profile-response.entity';
import type { WorkerProfile } from '@prisma/client';
import {
  mapWorkerFullProfile,
  mapWorkerMe,
} from '../utils/worker-profile.mapper';

@Injectable()
export class WorkersService {
  private readonly logger = new Logger(WorkersService.name);

  constructor(private readonly workersRepository: WorkersRepository) {}

  async getMe(userId: string) {
    const user = await this.workersRepository.findWorkerByUserId(userId);
    return mapWorkerMe(user as never);
  }

  async getFullProfile(userId: string) {
    return this.profileResponse(userId);
  }

  async getPublicProfile(workerId: string) {
    const p = await this.workersRepository.getPublicProfile(workerId);
    return {
      id: p.id,
      fullName: p.fullName,
      firstName: p.firstName,
      lastName: p.lastName,
      city: p.city,
      region: p.region,
      country: p.country,
      professionalTitle: p.professionalTitle,
      summary: p.bio,
      bio: p.bio,
      skills: p.skills,
      industries: p.industries,
      preferredJobCategories: p.preferredJobCategories,
      preferredJobTypes: p.preferredJobTypes,
      languages: p.languagesSpoken,
      availabilityStatus: p.availabilityStatus,
      profileCompleteness: p.profileCompleteness,
      verificationStatus: p.verificationStatus,
      workHistories: p.workHistories.map((w) => ({
        ...w,
        companyName: w.company,
        jobTitle: w.role,
        startDate: w.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: w.endDate?.toISOString().slice(0, 10) ?? null,
      })),
      educations: p.educations.map((e) => ({
        ...e,
        institution: e.school,
        startDate: e.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: e.endDate?.toISOString().slice(0, 10) ?? null,
      })),
      certifications: p.certifications.map((c) => ({
        ...c,
        issueDate: c.issueDate?.toISOString().slice(0, 10) ?? null,
        expiryDate: c.expiryDate?.toISOString().slice(0, 10) ?? null,
      })),
    };
  }

  async putProfile(userId: string, dto: UpsertWorkerProfileDto) {
    const workerId = await this.resolveWorkerId(userId);

    if (
      dto.firstName !== undefined ||
      dto.lastName !== undefined ||
      dto.city !== undefined ||
      dto.region !== undefined ||
      dto.country !== undefined ||
      dto.languages !== undefined ||
      dto.availabilityStatus !== undefined
    ) {
      await this.workersRepository.updatePersonalInfo(workerId, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        city: dto.city,
        region: dto.region,
        country: dto.country,
        languages: dto.languages,
        availabilityStatus: dto.availabilityStatus,
      });
    }

    if (
      dto.professionalTitle !== undefined ||
      dto.summary !== undefined ||
      dto.industries !== undefined ||
      dto.preferredJobCategories !== undefined ||
      dto.preferredJobTypes !== undefined
    ) {
      await this.workersRepository.updateProfessionalSummary(workerId, {
        professionalTitle: dto.professionalTitle,
        summary: dto.summary,
        industries: dto.industries,
        preferredJobCategories: dto.preferredJobCategories,
        preferredJobTypes: dto.preferredJobTypes,
      });
    }

    if (dto.skills !== undefined) {
      await this.workersRepository.updateSkills(workerId, {
        skills: dto.skills,
      });
    }

    if (dto.workHistories !== undefined) {
      const items = dto.workHistories.map((row) => {
        const company = row.company ?? row.companyName;
        const role = row.role ?? row.jobTitle;
        if (!company || !role) {
          throw new BadRequestException(
            'Each work history item requires companyName and jobTitle',
          );
        }
        return {
          company,
          role,
          location: row.location,
          description: row.description,
          startDate: row.startDate,
          endDate: row.endDate,
          isCurrent: row.isCurrent,
        };
      });
      await this.workersRepository.replaceWorkHistories(workerId, items);
    }

    if (dto.educations !== undefined) {
      const items = dto.educations.map((row) => {
        const school = row.school ?? row.institution;
        if (!school) {
          throw new BadRequestException(
            'Each education item requires institution or school',
          );
        }
        return {
          school,
          degree: row.degree,
          fieldOfStudy: row.fieldOfStudy,
          startDate: row.startDate,
          endDate: row.endDate,
          isCurrent: row.isCurrent,
        };
      });
      await this.workersRepository.replaceEducations(workerId, items);
    }

    if (dto.certifications !== undefined) {
      await this.workersRepository.replaceCertifications(
        workerId,
        dto.certifications.map((c) => ({
          name: c.name,
          issuer: c.issuer,
          issueDate: c.issueDate,
          expiryDate: c.expiryDate,
          fileUrl: c.fileUrl,
        })),
      );
    }

    if (
      dto.mobileMoneyProvider !== undefined ||
      dto.mobileMoneyNumber !== undefined
    ) {
      await this.workersRepository.updatePaymentDetails(workerId, {
        mobileMoneyProvider: dto.mobileMoneyProvider,
        mobileMoneyNumber: dto.mobileMoneyNumber,
      });
    }

    if (dto.paymentAccounts !== undefined) {
      await this.workersRepository.syncPaymentAccounts(
        workerId,
        dto.paymentAccounts,
      );
    }

    await this.workersRepository.recomputeCompleteness(workerId);
    return this.profileResponse(userId);
  }

  async updatePersonalInfo(userId: string, dto: UpdatePersonalInfoDto) {
    const workerId = await this.resolveWorkerId(userId);
    await this.workersRepository.updatePersonalInfo(workerId, dto);
    await this.workersRepository.recomputeCompleteness(workerId);
    return this.profileResponse(userId);
  }

  async updateProfessionalSummary(
    userId: string,
    dto: UpdateProfessionalSummaryDto,
  ) {
    const workerId = await this.resolveWorkerId(userId);
    await this.workersRepository.updateProfessionalSummary(workerId, dto);
    await this.workersRepository.recomputeCompleteness(workerId);
    return this.profileResponse(userId);
  }

  async updateSkills(userId: string, dto: UpdateSkillsDto) {
    const workerId = await this.resolveWorkerId(userId);
    await this.workersRepository.updateSkills(workerId, dto);
    await this.workersRepository.recomputeCompleteness(workerId);
    return this.profileResponse(userId);
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const workerId = await this.resolveWorkerId(userId);
    await this.workersRepository.updateAvatar(workerId, avatarUrl);
    await this.workersRepository.recomputeCompleteness(workerId);
    return this.profileResponse(userId);
  }

  async createWorkHistory(userId: string, dto: CreateWorkHistoryDto) {
    const company = dto.company ?? dto.companyName;
    const role = dto.role ?? dto.jobTitle;
    if (!company || !role) {
      throw new BadRequestException('companyName and jobTitle are required');
    }

    if (dto.isCurrent && dto.endDate) {
      throw new BadRequestException(
        'A current position cannot have an end date',
      );
    }

    const workerId = await this.resolveWorkerId(userId);
    const entry = await this.workersRepository.createWorkHistory(workerId, {
      ...dto,
      company,
      role,
    });
    await this.workersRepository.recomputeCompleteness(workerId);
    return entry;
  }

  async updateWorkHistory(
    userId: string,
    workId: string,
    dto: UpdateWorkHistoryDto,
  ) {
    const workerId = await this.resolveWorkerId(userId);
    await this.workersRepository.updateWorkHistory(workId, workerId, dto);
    await this.workersRepository.recomputeCompleteness(workerId);
    return this.profileResponse(userId);
  }

  async deleteWorkHistory(userId: string, workId: string) {
    const workerId = await this.resolveWorkerId(userId);
    await this.workersRepository.deleteWorkHistory(workId, workerId);
    await this.workersRepository.recomputeCompleteness(workerId);
  }

  async createEducation(userId: string, dto: CreateEducationDto) {
    const school = dto.school ?? dto.institution;
    if (!school) {
      throw new BadRequestException('institution or school is required');
    }

    if (dto.isCurrent && dto.endDate) {
      throw new BadRequestException(
        'A current education entry cannot have an end date',
      );
    }

    const workerId = await this.resolveWorkerId(userId);
    const entry = await this.workersRepository.createEducation(workerId, {
      ...dto,
      school,
    });
    await this.workersRepository.recomputeCompleteness(workerId);
    return entry;
  }

  async updateEducation(
    userId: string,
    educationId: string,
    dto: UpdateEducationDto,
  ) {
    const workerId = await this.resolveWorkerId(userId);
    await this.workersRepository.updateEducation(educationId, workerId, dto);
    await this.workersRepository.recomputeCompleteness(workerId);
    return this.profileResponse(userId);
  }

  async deleteEducation(userId: string, educationId: string) {
    const workerId = await this.resolveWorkerId(userId);
    await this.workersRepository.deleteEducation(educationId, workerId);
    await this.workersRepository.recomputeCompleteness(workerId);
  }

  async createCertification(userId: string, dto: CreateCertificationDto) {
    const workerId = await this.resolveWorkerId(userId);
    return this.workersRepository.createCertification(workerId, dto);
  }

  async updateCertification(
    userId: string,
    certId: string,
    dto: UpdateCertificationDto,
  ) {
    const workerId = await this.resolveWorkerId(userId);
    return this.workersRepository.updateCertification(certId, workerId, dto);
  }

  async deleteCertification(userId: string, certId: string) {
    const workerId = await this.resolveWorkerId(userId);
    return this.workersRepository.deleteCertification(certId, workerId);
  }

  async uploadDocument(
    userId: string,
    fileUrl: string,
    fileName: string,
    type: string,
    mimeType?: string,
    fileSize?: number,
  ) {
    const workerId = await this.resolveWorkerId(userId);
    const doc = await this.workersRepository.createDocument(
      workerId,
      fileUrl,
      fileName,
      type,
      mimeType,
      fileSize,
    );
    return {
      id: doc.id,
      type: doc.type,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      url: doc.fileUrl,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      uploadedAt: doc.uploadedAt.toISOString(),
    };
  }

  async getDocuments(userId: string) {
    const workerId = await this.resolveWorkerId(userId);
    const docs = await this.workersRepository.getDocuments(workerId);
    return docs.map((d) => ({
      id: d.id,
      type: d.type,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      url: d.fileUrl,
      fileSize: d.fileSize,
      mimeType: d.mimeType,
      uploadedAt: d.uploadedAt.toISOString(),
    }));
  }

  async deleteDocument(userId: string, documentId: string) {
    const workerId = await this.resolveWorkerId(userId);
    return this.workersRepository.deleteDocument(documentId, workerId);
  }

  async submitKYC(userId: string, dto: SubmitKYCDto) {
    const workerId = await this.resolveWorkerId(userId);
    const existing = await this.workersRepository.getKYCStatus(workerId);

    if (existing?.status === 'PENDING') {
      throw new BadRequestException(
        'A KYC submission is already under review. Please wait for the result before resubmitting.',
      );
    }

    if (existing?.status === 'VERIFIED') {
      throw new BadRequestException('Your identity has already been verified.');
    }

    await this.workersRepository.submitKYC(workerId, dto);
    await this.workersRepository.recomputeCompleteness(workerId);
    this.logger.log(`KYC submitted for worker ${workerId}`);
    return this.getKYCStatus(userId);
  }

  async getKYCStatus(userId: string) {
    const workerId = await this.resolveWorkerId(userId);
    const row = await this.workersRepository.getKYCStatus(workerId);
    if (!row) return { status: null };
    return {
      id: row.id,
      documentType: row.documentType,
      status: row.status,
      frontIdImageUrl: row.frontImageUrl,
      backIdImageUrl: row.backImageUrl,
      selfieImageUrl: row.selfieImageUrl,
      rejectionReason: row.rejectionReason,
      submittedAt: row.submittedAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
  }

  async updatePaymentDetails(userId: string, dto: UpdatePaymentDetailsDto) {
    const workerId = await this.resolveWorkerId(userId);
    await this.workersRepository.updatePaymentDetails(workerId, dto);
    await this.workersRepository.recomputeCompleteness(workerId);
    return this.profileResponse(userId);
  }

  async listPaymentAccounts(userId: string) {
    const workerId = await this.resolveWorkerId(userId);
    const items = await this.workersRepository.listPaymentAccounts(workerId);
    return { items };
  }

  async createPaymentAccount(userId: string, dto: CreatePaymentAccountDto) {
    const workerId = await this.resolveWorkerId(userId);
    const account = await this.workersRepository.createPaymentAccount(
      workerId,
      dto,
    );
    return account;
  }

  async updatePaymentAccount(
    userId: string,
    accountId: string,
    dto: UpdatePaymentAccountDto,
  ) {
    const workerId = await this.resolveWorkerId(userId);
    return this.workersRepository.updatePaymentAccount(
      accountId,
      workerId,
      dto,
    );
  }

  async deletePaymentAccount(userId: string, accountId: string) {
    const workerId = await this.resolveWorkerId(userId);
    return this.workersRepository.deletePaymentAccount(accountId, workerId);
  }

  async assertCanApply(userId: string): Promise<string> {
    const workerId = await this.resolveWorkerId(userId);
    const profile = await this.workersRepository.getFullProfile(workerId);

    if (profile.profileCompleteness < MIN_COMPLETENESS_TO_APPLY) {
      throw new ForbiddenException(
        `Profile completeness is ${profile.profileCompleteness}%. ` +
          `A minimum of ${MIN_COMPLETENESS_TO_APPLY}% is required to apply.`,
      );
    }

    const kycOk = await this.workersRepository.hasVerifiedKyc(workerId);
    if (!kycOk) {
      throw new ForbiddenException(
        'Identity verification (KYC) must be approved before applying to jobs.',
      );
    }

    return workerId;
  }

  async assertKycVerified(userId: string): Promise<string> {
    const workerId = await this.resolveWorkerId(userId);
    const kycOk = await this.workersRepository.hasVerifiedKyc(workerId);
    if (!kycOk) {
      throw new ForbiddenException(
        'Identity verification (KYC) must be approved before posting jobs.',
      );
    }
    return workerId;
  }

  async ensureForUser(userId: string, displayName: string) {
    const existing = await this.workersRepository.findProfileByUserId(userId);
    if (existing) return existing;

    return this.workersRepository.createProfile(userId, displayName);
  }

  toResponse(profile: WorkerProfile): WorkerProfileResponseEntity {
    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.fullName,
      firstName: profile.firstName,
      lastName: profile.lastName,
      city: profile.city,
      region: profile.region,
      country: profile.country,
      professionalTitle: profile.professionalTitle,
      bio: profile.bio,
      skills: profile.skills,
      industries: profile.industries,
      preferredJobCategories: profile.preferredJobCategories,
      languagesSpoken: profile.languagesSpoken,
      availabilityStatus: profile.availabilityStatus,
      profileCompleteness: profile.profileCompleteness,
      verificationStatus: profile.verificationStatus,
      mobileMoneyProvider: profile.mobileMoneyProvider,
      mobileMoneyNumber: profile.mobileMoneyNumber,
      uploadedResumeUrl: profile.uploadedResumeUrl,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  async getWorkerProfileId(userId: string): Promise<string> {
    return this.resolveWorkerId(userId);
  }

  private async profileResponse(userId: string) {
    const user = await this.workersRepository.findWorkerByUserId(userId);
    const raw = await this.workersRepository.getFullProfile(
      user.workerProfile!.id,
    );
    return mapWorkerFullProfile(raw as never);
  }

  private async resolveWorkerId(userId: string): Promise<string> {
    const user = await this.workersRepository.findWorkerByUserId(userId);

    if (!user.workerProfile) {
      throw new ForbiddenException('No worker profile found for this account');
    }

    return user.workerProfile.id;
  }
}
