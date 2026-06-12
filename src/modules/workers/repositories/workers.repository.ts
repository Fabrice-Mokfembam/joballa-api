import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AvailabilityStatus,
  KYCDocumentType,
  Prisma,
  DocumentType,
} from '@prisma/client';
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
} from '../dto/workers.dto';
import { computeProfileStrengthBreakdown } from '../utils/profile-strength.util';
import { PROFILE_COMPLETENESS_WEIGHTS } from '../workers.constants';

@Injectable()
export class WorkersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // ME / AUTH CONTEXT
  // ─────────────────────────────────────────────────────────────────────────

  async findWorkerByUserId(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        languagePreference: true,
        verificationStatus: true,
        workerProfile: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
            city: true,
            region: true,
            country: true,
            professionalTitle: true,
            bio: true,
            skills: true,
            languagesSpoken: true,
            avatarUrl: true,
            profileCompleteness: true,
            profileStrengthBreakdown: true,
            profileViews: true,
            availabilityStatus: true,
            verificationStatus: true,
            nationalIdDocUrl: true,
            uploadedResumeUrl: true,
          },
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTH INTEGRATION — called by WorkersService.ensureForUser()
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns the raw WorkerProfile for this userId, or null if none exists.
   * Used by ensureForUser() to check before attempting creation.
   */
  async findProfileByUserId(userId: string) {
    return this.prisma.workerProfile.findUnique({
      where: { userId },
    });
  }

  /**
   * Creates a minimal WorkerProfile for a newly registered worker.
   * displayName is seeded from the auth identifier (email prefix or phone suffix).
   * All optional fields are left null — the worker fills them in via the profile builder.
   */
  async createProfile(userId: string, displayName: string) {
    return this.prisma.workerProfile.create({
      data: {
        userId,
        fullName: displayName,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FULL PROFILE
  // ─────────────────────────────────────────────────────────────────────────

  async getFullProfile(workerId: string) {
    return this.prisma.workerProfile.findUniqueOrThrow({
      where: { id: workerId },
      include: {
        workHistories: { orderBy: { startDate: 'desc' } },
        educations: { orderBy: { startDate: 'desc' } },
        certifications: { orderBy: { issueDate: 'desc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
        kycSubmissions: { orderBy: { submittedAt: 'desc' } },
        paymentAccounts: { orderBy: { createdAt: 'asc' } },
        user: {
          select: { email: true, phone: true, languagePreference: true },
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC PROFILE
  // ─────────────────────────────────────────────────────────────────────────

  async getPublicProfile(workerId: string) {
    return this.prisma.workerProfile.findUniqueOrThrow({
      where: { id: workerId },
      select: {
        id: true,
        fullName: true,
        firstName: true,
        lastName: true,
        city: true,
        region: true,
        country: true,
        professionalTitle: true,
        bio: true,
        skills: true,
        industries: true,
        preferredJobCategories: true,
        preferredJobTypes: true,
        availabilityStatus: true,
        languagesSpoken: true,
        profileCompleteness: true,
        verificationStatus: true,
        workHistories: {
          orderBy: { startDate: 'desc' },
          select: {
            id: true,
            company: true,
            role: true,
            location: true,
            description: true,
            startDate: true,
            endDate: true,
            isCurrent: true,
          },
        },
        educations: {
          orderBy: { startDate: 'desc' },
          select: {
            id: true,
            school: true,
            degree: true,
            fieldOfStudy: true,
            startDate: true,
            endDate: true,
            isCurrent: true,
          },
        },
        certifications: {
          select: {
            id: true,
            name: true,
            issuer: true,
            issueDate: true,
            expiryDate: true,
          },
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PERSONAL INFO
  // ─────────────────────────────────────────────────────────────────────────

  async updatePersonalInfo(workerId: string, dto: UpdatePersonalInfoDto) {
    const data: Prisma.WorkerProfileUpdateInput = {};

    // fullNames is a single-string seed from AuthService.selectRole()
    if (dto.fullNames !== undefined) {
      data.fullName = dto.fullNames.trim();
    }

    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.region !== undefined) data.region = dto.region;
    if (dto.languages !== undefined) data.languagesSpoken = dto.languages;

    // Derive fullName from parts only when firstName/lastName is provided
    if (
      dto.fullNames === undefined &&
      (dto.firstName !== undefined || dto.lastName !== undefined)
    ) {
      const current = await this.prisma.workerProfile.findUniqueOrThrow({
        where: { id: workerId },
        select: { firstName: true, lastName: true },
      });
      const first = dto.firstName ?? current.firstName ?? '';
      const last = dto.lastName ?? current.lastName ?? '';
      data.fullName = `${first} ${last}`.trim();
    }

    if (dto.availabilityStatus !== undefined) {
      data.availabilityStatus = dto.availabilityStatus;
    } else if (dto.availableToWork !== undefined) {
      data.availabilityStatus = dto.availableToWork
        ? AvailabilityStatus.AVAILABLE
        : AvailabilityStatus.NOT_AVAILABLE;
    }

    return this.prisma.workerProfile.update({
      where: { id: workerId },
      data,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROFESSIONAL SUMMARY
  // ─────────────────────────────────────────────────────────────────────────

  async updateProfessionalSummary(
    workerId: string,
    dto: UpdateProfessionalSummaryDto,
  ) {
    return this.prisma.workerProfile.update({
      where: { id: workerId },
      data: {
        ...(dto.title !== undefined || dto.professionalTitle !== undefined
          ? {
              professionalTitle: dto.title ?? dto.professionalTitle,
            }
          : {}),
        ...(dto.summary !== undefined || dto.bio !== undefined
          ? { bio: dto.summary ?? dto.bio }
          : {}),
        ...(dto.industries !== undefined && { industries: dto.industries }),
        ...(dto.preferredJobCategories !== undefined && {
          preferredJobCategories: dto.preferredJobCategories,
        }),
        ...(dto.preferredJobTypes !== undefined && {
          preferredJobTypes: dto.preferredJobTypes,
        }),
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SKILLS
  // ─────────────────────────────────────────────────────────────────────────

  async updateSkills(workerId: string, dto: UpdateSkillsDto) {
    return this.prisma.workerProfile.update({
      where: { id: workerId },
      data: { skills: dto.skills },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AVATAR
  // ─────────────────────────────────────────────────────────────────────────

  async updateAvatar(workerId: string, avatarUrl: string) {
    return this.prisma.workerProfile.update({
      where: { id: workerId },
      data: { avatarUrl },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORK HISTORY
  // ─────────────────────────────────────────────────────────────────────────

  async createWorkHistory(workerId: string, dto: CreateWorkHistoryDto) {
    return this.prisma.workHistory.create({
      data: {
        workerId,
        company: dto.company ?? dto.companyName ?? '',
        role: dto.role ?? dto.jobTitle ?? '',
        location: dto.location,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isCurrent: dto.isCurrent ?? false,
      },
    });
  }

  async updateWorkHistory(
    workId: string,
    workerId: string,
    dto: UpdateWorkHistoryDto,
  ) {
    return this.prisma.workHistory.update({
      where: { id: workId, workerId }, // scoped to this worker — prevents tampering
      data: {
        ...((dto.company || dto.companyName) && {
          company: dto.company ?? dto.companyName,
        }),
        ...((dto.role || dto.jobTitle) && {
          role: dto.role ?? dto.jobTitle,
        }),
        ...(dto.location && { location: dto.location }),
        ...(dto.description && { description: dto.description }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        ...(dto.isCurrent !== undefined && { isCurrent: dto.isCurrent }),
      },
    });
  }

  async deleteWorkHistory(workId: string, workerId: string) {
    return this.prisma.workHistory.delete({
      where: { id: workId, workerId },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EDUCATION
  // ─────────────────────────────────────────────────────────────────────────

  async createEducation(workerId: string, dto: CreateEducationDto) {
    return this.prisma.education.create({
      data: {
        workerId,
        school: dto.school ?? dto.institution ?? '',
        degree: dto.degree,
        fieldOfStudy: dto.fieldOfStudy,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isCurrent: dto.isCurrent ?? false,
      },
    });
  }

  async updateEducation(
    educationId: string,
    workerId: string,
    dto: UpdateEducationDto,
  ) {
    return this.prisma.education.update({
      where: { id: educationId, workerId },
      data: {
        ...((dto.school || dto.institution) && {
          school: dto.school ?? dto.institution,
        }),
        ...(dto.degree && { degree: dto.degree }),
        ...(dto.fieldOfStudy && { fieldOfStudy: dto.fieldOfStudy }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        ...(dto.isCurrent !== undefined && { isCurrent: dto.isCurrent }),
      },
    });
  }

  async deleteEducation(educationId: string, workerId: string) {
    return this.prisma.education.delete({
      where: { id: educationId, workerId },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CERTIFICATIONS
  // ─────────────────────────────────────────────────────────────────────────

  async createCertification(workerId: string, dto: CreateCertificationDto) {
    return this.prisma.certification.create({
      data: {
        workerId,
        name: dto.name,
        issuer: dto.issuer,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        fileUrl: dto.fileUrl,
      },
    });
  }

  async updateCertification(
    certId: string,
    workerId: string,
    dto: UpdateCertificationDto,
  ) {
    return this.prisma.certification.update({
      where: { id: certId, workerId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.issuer && { issuer: dto.issuer }),
        ...(dto.issueDate && { issueDate: new Date(dto.issueDate) }),
        ...(dto.expiryDate && { expiryDate: new Date(dto.expiryDate) }),
        ...(dto.fileUrl && { fileUrl: dto.fileUrl }),
      },
    });
  }

  async deleteCertification(certId: string, workerId: string) {
    return this.prisma.certification.delete({
      where: { id: certId, workerId },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOCUMENTS
  // ─────────────────────────────────────────────────────────────────────────

  async createDocument(
    workerId: string,
    fileUrl: string,
    fileName: string,
    type: string,
    mimeType?: string,
    fileSize?: number,
  ) {
    return this.prisma.workerDocument.create({
      data: {
        workerId,
        fileUrl,
        fileName,
        type: type as DocumentType,
        mimeType,
        fileSize,
      },
    });
  }

  async getDocuments(workerId: string) {
    return this.prisma.workerDocument.findMany({
      where: { workerId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async deleteDocument(documentId: string, workerId: string) {
    return this.prisma.workerDocument.delete({
      where: { id: documentId, workerId },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KYC
  // ─────────────────────────────────────────────────────────────────────────

  async submitKYC(workerId: string, dto: SubmitKYCDto) {
    return this.prisma.kYCSubmission.create({
      data: {
        workerId,
        documentType: dto.documentType as KYCDocumentType,
        frontImageUrl: dto.frontIdImageUrl,
        backImageUrl: dto.backIdImageUrl,
        selfieImageUrl: dto.selfieImageUrl,
      },
    });
  }

  async hasVerifiedKyc(workerId: string): Promise<boolean> {
    const row = await this.prisma.kYCSubmission.findFirst({
      where: { workerId, status: 'VERIFIED' },
      select: { id: true },
    });
    return Boolean(row);
  }

  async getKYCStatus(workerId: string) {
    return this.prisma.kYCSubmission.findFirst({
      where: { workerId },
      orderBy: { submittedAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAYMENT DETAILS
  // ─────────────────────────────────────────────────────────────────────────

  async updatePaymentDetails(workerId: string, dto: UpdatePaymentDetailsDto) {
    return this.prisma.workerProfile.update({
      where: { id: workerId },
      data: {
        ...(dto.mobileMoneyProvider && {
          mobileMoneyProvider: dto.mobileMoneyProvider,
        }),
        ...(dto.mobileMoneyNumber && {
          mobileMoneyNumber: dto.mobileMoneyNumber,
        }),
        ...(dto.bankName && { bankName: dto.bankName }),
        ...(dto.accountNumber && { bankAccountNumber: dto.accountNumber }),
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROFILE COMPLETENESS — called after any profile update
  // ─────────────────────────────────────────────────────────────────────────

  async recomputeCompleteness(workerId: string): Promise<number> {
    const profile = await this.prisma.workerProfile.findUniqueOrThrow({
      where: { id: workerId },
      include: {
        workHistories: { take: 1 },
        educations: { take: 1 },
        certifications: { take: 1 },
        kycSubmissions: true,
      },
    });

    const breakdown = computeProfileStrengthBreakdown({
      ...profile,
      workHistories: profile.workHistories,
      educations: profile.educations,
      certifications: profile.certifications,
      kycSubmissions: profile.kycSubmissions,
    });

    const w = PROFILE_COMPLETENESS_WEIGHTS;
    let score = 0;
    if (profile.fullName?.trim()) score += w.fullName;
    if (profile.professionalTitle?.trim()) score += w.professionalTitle;
    if (profile.bio?.trim()) score += w.bio;
    if (profile.skills?.length) score += w.skills;
    if (profile.workHistories?.length) score += w.workHistory;
    if (profile.educations?.length || profile.certifications?.length) {
      score += w.education;
    }
    if (profile.languagesSpoken?.length) score += w.languagesSpoken;
    if (profile.avatarUrl?.trim()) score += w.avatar;
    if (profile.mobileMoneyNumber || profile.bankAccountNumber) {
      score += w.paymentDetails;
    }
    if (profile.kycSubmissions?.length) score += w.kyc;

    await this.prisma.workerProfile.update({
      where: { id: workerId },
      data: {
        profileCompleteness: score,
        profileStrengthBreakdown: breakdown as unknown as Prisma.InputJsonValue,
      },
    });

    return score;
  }

  async replaceWorkHistories(
    workerId: string,
    items: Array<{
      id?: string;
      company: string;
      role: string;
      location?: string;
      description?: string;
      startDate: string;
      endDate?: string;
      isCurrent?: boolean;
    }>,
  ) {
    await this.prisma.$transaction([
      this.prisma.workHistory.deleteMany({ where: { workerId } }),
      ...items.map((item) =>
        this.prisma.workHistory.create({
          data: {
            workerId,
            company: item.company,
            role: item.role,
            location: item.location,
            description: item.description,
            startDate: new Date(item.startDate),
            endDate: item.endDate ? new Date(item.endDate) : null,
            isCurrent: item.isCurrent ?? false,
          },
        }),
      ),
    ]);
  }

  async replaceEducations(
    workerId: string,
    items: Array<{
      school: string;
      degree?: string;
      fieldOfStudy?: string;
      startDate: string;
      endDate?: string;
      isCurrent?: boolean;
    }>,
  ) {
    await this.prisma.$transaction([
      this.prisma.education.deleteMany({ where: { workerId } }),
      ...items.map((item) =>
        this.prisma.education.create({
          data: {
            workerId,
            school: item.school,
            degree: item.degree,
            fieldOfStudy: item.fieldOfStudy,
            startDate: new Date(item.startDate),
            endDate: item.endDate ? new Date(item.endDate) : null,
            isCurrent: item.isCurrent ?? false,
          },
        }),
      ),
    ]);
  }

  async replaceCertifications(
    workerId: string,
    items: Array<{
      name: string;
      issuer?: string;
      issueDate?: string;
      expiryDate?: string;
      fileUrl?: string;
    }>,
  ) {
    await this.prisma.$transaction([
      this.prisma.certification.deleteMany({ where: { workerId } }),
      ...items.map((item) =>
        this.prisma.certification.create({
          data: {
            workerId,
            name: item.name,
            issuer: item.issuer,
            issueDate: item.issueDate ? new Date(item.issueDate) : null,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            fileUrl: item.fileUrl,
          },
        }),
      ),
    ]);
  }

  async listPaymentAccounts(workerId: string) {
    return this.prisma.workerPaymentAccount.findMany({
      where: { workerId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createPaymentAccount(
    workerId: string,
    data: { provider: string; phone: string; isPrimary?: boolean },
  ) {
    if (data.isPrimary) {
      await this.prisma.workerPaymentAccount.updateMany({
        where: { workerId },
        data: { isPrimary: false },
      });
    }
    return this.prisma.workerPaymentAccount.create({
      data: {
        workerId,
        provider: data.provider as never,
        phone: data.phone,
        isPrimary: data.isPrimary ?? false,
      },
    });
  }

  async updatePaymentAccount(
    accountId: string,
    workerId: string,
    data: { phone?: string; isPrimary?: boolean },
  ) {
    if (data.isPrimary) {
      await this.prisma.workerPaymentAccount.updateMany({
        where: { workerId },
        data: { isPrimary: false },
      });
    }
    return this.prisma.workerPaymentAccount.update({
      where: { id: accountId, workerId },
      data: {
        ...(data.phone && { phone: data.phone }),
        ...(data.isPrimary !== undefined && { isPrimary: data.isPrimary }),
      },
    });
  }

  async deletePaymentAccount(accountId: string, workerId: string) {
    return this.prisma.workerPaymentAccount.delete({
      where: { id: accountId, workerId },
    });
  }

  async syncPaymentAccounts(
    workerId: string,
    accounts: Array<{ provider: string; phone: string; isPrimary?: boolean }>,
  ) {
    await this.prisma.workerPaymentAccount.deleteMany({ where: { workerId } });
    for (const account of accounts) {
      await this.createPaymentAccount(workerId, account);
    }
  }
}
