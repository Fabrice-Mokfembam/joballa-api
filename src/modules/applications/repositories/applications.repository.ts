import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ApplicationStatus, Prisma } from '@prisma/client';
import {
  CustomizeProfileDto,
  SubmitApplicationDto,
  ApplicationFilterDto,
  UpdateApplicationStatusDto,
} from '../dto/applications.dto';

@Injectable()
export class ApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOMIZATION DRAFT
  // ─────────────────────────────────────────────────────────────────────────

  async upsertCustomization(
    workerId: string,
    jobId: string,
    dto: CustomizeProfileDto,
  ) {
    // TTL: draft expires in 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return this.prisma.applicationCustomization.upsert({
      where: { workerId_jobId: { workerId, jobId } },
      create: {
        workerId,
        jobId,
        professionalSummary: dto.professionalSummary,
        skills: dto.skills ?? [],
        workHistoryIds: dto.workHistoryIds ?? [],
        expiresAt,
      },
      update: {
        professionalSummary: dto.professionalSummary,
        skills: dto.skills ?? [],
        workHistoryIds: dto.workHistoryIds ?? [],
        expiresAt,
      },
    });
  }

  async getCustomization(workerId: string, jobId: string) {
    return this.prisma.applicationCustomization.findUnique({
      where: { workerId_jobId: { workerId, jobId } },
    });
  }

  async deleteCustomization(workerId: string, jobId: string) {
    return this.prisma.applicationCustomization.deleteMany({
      where: { workerId, jobId },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMIT APPLICATION
  // ─────────────────────────────────────────────────────────────────────────

  async submitApplication(
    workerId: string,
    jobId: string,
    dto: SubmitApplicationDto,
    profileSnapshot: Prisma.InputJsonValue,
  ) {
    const application = await this.prisma.application.create({
      data: {
        jobId,
        workerId,
        profileSnapshot,
        jobSpecificNote: dto.jobSpecificNote,
        attachedDocuments: dto.attachedDocuments ?? [],
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            category: true,
            location: true,
            payRate: true,
            payStructure: true,
            employer: { select: { companyName: true, logoUrl: true } },
          },
        },
      },
    });

    // Clean up the customization draft now that application is submitted
    await this.deleteCustomization(workerId, jobId);

    return application;
  }

  async hasApplied(workerId: string, jobId: string): Promise<boolean> {
    const existing = await this.prisma.application.findUnique({
      where: { jobId_workerId: { jobId, workerId } },
      select: { id: true },
    });
    return !!existing;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — APPLICATION LIST
  // ─────────────────────────────────────────────────────────────────────────

  async getWorkerApplications(workerId: string, dto: ApplicationFilterDto) {
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.ApplicationWhereInput = {
      workerId,
      archivedAt: null, // exclude soft-deleted
      ...(dto.status && { status: dto.status as ApplicationStatus }),
    };

    const [items, total] = await this.prisma.$transaction([
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
              category: true,
              location: true,
              payRate: true,
              payStructure: true,
              employer: { select: { companyName: true, logoUrl: true } },
            },
          },
        },
      }),
      this.prisma.application.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getWorkerApplicationDetail(applicationId: string, workerId: string) {
    return this.prisma.application.findUniqueOrThrow({
      where: { id: applicationId, workerId },
      include: {
        job: {
          include: {
            employer: {
              select: {
                id: true,
                companyName: true,
                logoUrl: true,
                industry: true,
                location: true,
              },
            },
          },
        },
        engagement: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            agreedRate: true,
            payStructure: true,
          },
        },
      },
    });
  }

  async archiveApplication(applicationId: string, workerId: string) {
    return this.prisma.application.update({
      where: { id: applicationId, workerId },
      data: { archivedAt: new Date() },
    });
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
    const skip = (page - 1) * limit;

    // Verify the job belongs to this employer
    await this.prisma.job.findUniqueOrThrow({
      where: { id: jobId, employerId },
      select: { id: true },
    });

    const where: Prisma.ApplicationWhereInput = {
      jobId,
      ...(status && { status: status as ApplicationStatus }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          jobSpecificNote: true,
          profileSnapshot: true,
          employerNotes: true,
        },
      }),
      this.prisma.application.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async updateApplicationStatus(
    applicationId: string,
    employerId: string,
    dto: UpdateApplicationStatusDto,
  ) {
    // Verify employer owns the job this application belongs to
    const application = await this.prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
      include: { job: { select: { employerId: true } } },
    });

    if (application.job.employerId !== employerId) {
      throw new Error('Forbidden');
    }

    return this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: dto.status as ApplicationStatus,
        employerNotes: dto.employerNotes,
      },
    });
  }
}
