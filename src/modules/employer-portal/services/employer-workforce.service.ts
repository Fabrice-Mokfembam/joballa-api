import { Injectable, NotFoundException } from '@nestjs/common';
import { EngagementStatus } from '@prisma/client';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import type { CreateShiftDto } from '../dto/create-shift.dto';
import type { ListWorkforceQueryDto } from '../dto/list-workforce-query.dto';
import type { UpdateShiftDto } from '../dto/update-shift.dto';
import type { UpdateWorkforceStatusDto } from '../dto/update-workforce-status.dto';
import {
  EmployerWorkforceRepository,
  type EngagementWithRelations,
} from '../repositories/employer-workforce.repository';
import { engagementStatusFromApi } from '../utils/application-status.util';
import { payStructureToPer } from '../utils/employer-job-type.util';
import { EmployerContextService } from './employer-context.service';

@Injectable()
export class EmployerWorkforceService {
  constructor(
    private readonly employerContext: EmployerContextService,
    private readonly workforceRepository: EmployerWorkforceRepository,
  ) {}

  async list(authUser: LocalAuthUser, query: ListWorkforceQueryDto) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    let statusFilter: EngagementStatus | undefined;

    const raw = query.status?.trim().toLowerCase();
    if (raw && raw !== 'all') {
      statusFilter = engagementStatusFromApi(raw);
    }

    const [stats, list] = await Promise.all([
      this.buildStats(profile.id),
      this.workforceRepository.listForEmployer(profile.id, {
        status: statusFilter,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      ...stats,
      items: list.items.map((e) => this.toWorkerRow(e)),
      total: list.total,
      page,
      limit,
    };
  }

  async getWorker(authUser: LocalAuthUser, workerId: string) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const engagement = await this.requireEngagement(workerId, profile.id);
    return {
      worker: this.toWorkerRow(engagement),
      engagement: {
        engagementId: engagement.id,
        jobId: engagement.jobId,
        jobTitle: engagement.job.title,
        startDate: engagement.startDate.toISOString(),
        endDate: engagement.endDate?.toISOString() ?? null,
        agreedRate: Number(engagement.agreedRate),
        payStructure: engagement.payStructure,
        per: payStructureToPer(engagement.payStructure),
        status: engagement.status.toLowerCase(),
        taskNotes: engagement.taskNotes,
      },
    };
  }

  async listShifts(
    authUser: LocalAuthUser,
    workerId: string,
    page = 1,
    limit = 50,
  ) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const engagement = await this.requireEngagement(workerId, profile.id);
    const { items, total } = await this.workforceRepository.listShifts(
      engagement.id,
      (page - 1) * limit,
      limit,
    );

    return {
      items: items.map((s) => this.toShift(s)),
      total,
      page,
      limit,
    };
  }

  async createShift(
    authUser: LocalAuthUser,
    workerId: string,
    dto: CreateShiftDto,
  ) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const engagement = await this.requireEngagement(workerId, profile.id);

    const shift = await this.workforceRepository.createShift({
      engagement: { connect: { id: engagement.id } },
      date: new Date(dto.date),
      hoursWorked: dto.hours,
      notes: dto.notes ?? null,
      loggedBy: 'employer',
    });

    return this.toShift(shift);
  }

  async updateShift(
    authUser: LocalAuthUser,
    workerId: string,
    shiftId: string,
    dto: UpdateShiftDto,
  ) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const engagement = await this.requireEngagement(workerId, profile.id);
    const shift = await this.workforceRepository.findShiftForEngagement(
      shiftId,
      engagement.id,
    );
    if (!shift) {
      throw new NotFoundException('Shift not found.');
    }

    const updated = await this.workforceRepository.updateShift(shiftId, {
      ...(dto.date !== undefined ? { date: new Date(dto.date) } : {}),
      ...(dto.hours !== undefined ? { hoursWorked: dto.hours } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    });
    return this.toShift(updated);
  }

  async deleteShift(
    authUser: LocalAuthUser,
    workerId: string,
    shiftId: string,
  ) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const engagement = await this.requireEngagement(workerId, profile.id);
    const shift = await this.workforceRepository.findShiftForEngagement(
      shiftId,
      engagement.id,
    );
    if (!shift) {
      throw new NotFoundException('Shift not found.');
    }
    await this.workforceRepository.deleteShift(shiftId);
    return { message: 'Shift deleted.' };
  }

  async updateWorkerStatus(
    authUser: LocalAuthUser,
    workerId: string,
    dto: UpdateWorkforceStatusDto,
  ) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const engagement = await this.requireEngagement(workerId, profile.id);
    const next = engagementStatusFromApi(dto.status);

    const updated = await this.workforceRepository.updateEngagement(
      engagement.id,
      {
        status: next,
        ...(next === EngagementStatus.TERMINATED ||
        next === EngagementStatus.COMPLETED
          ? { endDate: new Date() }
          : {}),
        taskNotes: dto.reason
          ? `${engagement.taskNotes ?? ''}\n${dto.reason}`.trim()
          : engagement.taskNotes,
      },
    );

    return {
      workerId,
      status: updated.status.toLowerCase(),
      message: 'Workforce status updated.',
    };
  }

  private async buildStats(employerProfileId: string) {
    const [activeList, shiftsMonth, ended] = await Promise.all([
      this.workforceRepository.listForEmployer(employerProfileId, {
        status: EngagementStatus.ACTIVE,
        skip: 0,
        take: 1,
      }),
      this.workforceRepository.countShiftsThisMonth(employerProfileId),
      this.workforceRepository.countEngagementsEnded(employerProfileId),
    ]);

    return {
      activeWorkers: {
        count: activeList.total,
        label: 'currently active',
      },
      totalShiftsThisMonth: {
        count: shiftsMonth,
        trend: 'this calendar month',
      },
      engagementsEnded: {
        count: ended,
        trend: 'terminated or completed',
      },
    };
  }

  private async requireEngagement(
    workerProfileId: string,
    employerProfileId: string,
  ): Promise<EngagementWithRelations> {
    const engagement = await this.workforceRepository.findEngagementForEmployer(
      workerProfileId,
      employerProfileId,
    );
    if (!engagement) {
      throw new NotFoundException(
        'No workforce engagement found for this worker.',
      );
    }
    return engagement;
  }

  private toWorkerRow(engagement: EngagementWithRelations) {
    return {
      workerId: engagement.workerId,
      engagementId: engagement.id,
      dateJoined: engagement.startDate.toISOString().slice(0, 10),
      name: engagement.worker.fullName,
      avatar: null,
      role: engagement.job.title,
      shiftsLogged: engagement.shiftLogs.length,
      jobType: engagement.job.jobType.replace(/_/g, '-').toLowerCase(),
      status: engagement.status.toLowerCase(),
    };
  }

  private toShift(shift: {
    id: string;
    date: Date;
    hoursWorked: { toString(): string } | number;
    notes: string | null;
    loggedBy: string;
  }) {
    return {
      shiftId: shift.id,
      date: shift.date.toISOString().slice(0, 10),
      hours: Number(shift.hoursWorked),
      notes: shift.notes ?? '',
      loggedBy: shift.loggedBy,
    };
  }
}
