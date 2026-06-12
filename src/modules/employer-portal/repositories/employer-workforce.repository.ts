import { Injectable } from '@nestjs/common';
import {
  EngagementStatus,
  Prisma,
  type ShiftLog,
  type WorkEngagement,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

const engagementInclude = {
  worker: true,
  job: true,
  shiftLogs: { orderBy: { date: 'desc' as const } },
} satisfies Prisma.WorkEngagementInclude;

export type EngagementWithRelations = Prisma.WorkEngagementGetPayload<{
  include: typeof engagementInclude;
}>;

@Injectable()
export class EmployerWorkforceRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForEmployer(
    employerProfileId: string,
    params: {
      status?: EngagementStatus;
      skip: number;
      take: number;
    },
  ): Promise<{ items: EngagementWithRelations[]; total: number }> {
    const where: Prisma.WorkEngagementWhereInput = {
      employerId: employerProfileId,
      ...(params.status ? { status: params.status } : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.workEngagement.findMany({
          where,
          include: engagementInclude,
          skip: params.skip,
          take: params.take,
          orderBy: { createdAt: 'desc' },
        }),
        tx.workEngagement.count({ where }),
      ]);
      return { items, total };
    });
  }

  findEngagementForEmployer(
    workerProfileId: string,
    employerProfileId: string,
  ): Promise<EngagementWithRelations | null> {
    return this.prisma.workEngagement.findFirst({
      where: {
        workerId: workerProfileId,
        employerId: employerProfileId,
      },
      include: engagementInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  findEngagementById(
    engagementId: string,
    employerProfileId: string,
  ): Promise<EngagementWithRelations | null> {
    return this.prisma.workEngagement.findFirst({
      where: { id: engagementId, employerId: employerProfileId },
      include: engagementInclude,
    });
  }

  createEngagement(
    data: Prisma.WorkEngagementCreateInput,
  ): Promise<WorkEngagement> {
    return this.prisma.workEngagement.create({ data });
  }

  updateEngagement(
    id: string,
    data: Prisma.WorkEngagementUpdateInput,
  ): Promise<WorkEngagement> {
    return this.prisma.workEngagement.update({ where: { id }, data });
  }

  countShiftsThisMonth(employerProfileId: string): Promise<number> {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return this.prisma.shiftLog.count({
      where: {
        engagement: { employerId: employerProfileId },
        date: { gte: start },
      },
    });
  }

  countEngagementsEnded(employerProfileId: string): Promise<number> {
    return this.prisma.workEngagement.count({
      where: {
        employerId: employerProfileId,
        status: {
          in: [EngagementStatus.TERMINATED, EngagementStatus.COMPLETED],
        },
      },
    });
  }

  listShifts(
    engagementId: string,
    skip: number,
    take: number,
  ): Promise<{ items: ShiftLog[]; total: number }> {
    return this.prisma.$transaction(async (tx) => {
      const where = { engagementId };
      const [items, total] = await Promise.all([
        tx.shiftLog.findMany({
          where,
          orderBy: { date: 'desc' },
          skip,
          take,
        }),
        tx.shiftLog.count({ where }),
      ]);
      return { items, total };
    });
  }

  createShift(data: Prisma.ShiftLogCreateInput): Promise<ShiftLog> {
    return this.prisma.shiftLog.create({ data });
  }

  findShiftForEngagement(
    shiftId: string,
    engagementId: string,
  ): Promise<ShiftLog | null> {
    return this.prisma.shiftLog.findFirst({
      where: { id: shiftId, engagementId },
    });
  }

  updateShift(
    shiftId: string,
    data: Prisma.ShiftLogUpdateInput,
  ): Promise<ShiftLog> {
    return this.prisma.shiftLog.update({ where: { id: shiftId }, data });
  }

  deleteShift(shiftId: string): Promise<ShiftLog> {
    return this.prisma.shiftLog.delete({ where: { id: shiftId } });
  }
}
