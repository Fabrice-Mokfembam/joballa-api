import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EngagementStatus, Prisma } from '@prisma/client';
import {
  LogShiftDto,
  EndEngagementDto,
  EngagementFilterDto,
} from '../dto/engagements.dto';

const ENGAGEMENT_INCLUDE = {
  job: {
    select: {
      id: true,
      title: true,
      category: true,
      location: true,
      payRate: true,
      payStructure: true,
    },
  },
  worker: {
    select: {
      id: true,
      fullName: true,
      professionalTitle: true,
      city: true,
      verificationStatus: true,
    },
  },
  employer: {
    select: {
      id: true,
      companyName: true,
      logoUrl: true,
    },
  },
  shiftLogs: {
    orderBy: { date: 'desc' as const },
  },
  _count: {
    select: { payments: true, shiftLogs: true },
  },
} as const;

@Injectable()
export class EngagementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — their engagements
  // ─────────────────────────────────────────────────────────────────────────

  async getWorkerEngagements(workerId: string, dto: EngagementFilterDto) {
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkEngagementWhereInput = {
      workerId,
      ...(dto.status && { status: dto.status as EngagementStatus }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.workEngagement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: ENGAGEMENT_INCLUDE,
      }),
      this.prisma.workEngagement.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getWorkerEngagementDetail(engagementId: string, workerId: string) {
    return this.prisma.workEngagement.findUniqueOrThrow({
      where: { id: engagementId, workerId },
      include: ENGAGEMENT_INCLUDE,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EMPLOYER — their engagements
  // ─────────────────────────────────────────────────────────────────────────

  async getEmployerEngagements(employerId: string, dto: EngagementFilterDto) {
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkEngagementWhereInput = {
      employerId,
      ...(dto.status && { status: dto.status as EngagementStatus }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.workEngagement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: ENGAGEMENT_INCLUDE,
      }),
      this.prisma.workEngagement.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getEmployerEngagementDetail(engagementId: string, employerId: string) {
    return this.prisma.workEngagement.findUniqueOrThrow({
      where: { id: engagementId, employerId },
      include: ENGAGEMENT_INCLUDE,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHIFT LOGS
  // ─────────────────────────────────────────────────────────────────────────

  async logShift(engagementId: string, employerId: string, dto: LogShiftDto) {
    // Verify the engagement belongs to this employer
    await this.prisma.workEngagement.findUniqueOrThrow({
      where: { id: engagementId, employerId },
      select: { id: true },
    });

    return this.prisma.shiftLog.create({
      data: {
        engagementId,
        date: new Date(dto.date),
        hoursWorked: dto.hoursWorked,
        notes: dto.notes,
        loggedBy: 'employer',
      },
    });
  }

  async getShiftLogs(engagementId: string, employerId: string) {
    // Verify ownership
    await this.prisma.workEngagement.findUniqueOrThrow({
      where: { id: engagementId, employerId },
      select: { id: true },
    });

    return this.prisma.shiftLog.findMany({
      where: { engagementId },
      orderBy: { date: 'desc' },
    });
  }

  async deleteShiftLog(shiftLogId: string, employerId: string) {
    // Verify log belongs to an engagement owned by this employer
    const log = await this.prisma.shiftLog.findUniqueOrThrow({
      where: { id: shiftLogId },
      include: { engagement: { select: { employerId: true } } },
    });

    if (log.engagement.employerId !== employerId) {
      throw new Error('Forbidden');
    }

    return this.prisma.shiftLog.delete({ where: { id: shiftLogId } });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // END ENGAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  async endEngagement(
    engagementId: string,
    employerId: string,
    dto: EndEngagementDto,
  ) {
    return this.prisma.workEngagement.update({
      where: { id: engagementId, employerId },
      data: {
        status: EngagementStatus.TERMINATED,
        endDate: dto.endDate ? new Date(dto.endDate) : new Date(),
        taskNotes: dto.reason,
      },
    });
  }
}
