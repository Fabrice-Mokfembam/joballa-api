import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { EngagementsRepository } from '../repositories/engagements.repository';
import {
  LogShiftDto,
  EndEngagementDto,
  EngagementFilterDto,
} from '../dto/engagements.dto';

@Injectable()
export class EngagementsService {
  private readonly logger = new Logger(EngagementsService.name);

  constructor(private readonly engagementsRepository: EngagementsRepository) {}

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER
  // ─────────────────────────────────────────────────────────────────────────

  getWorkerEngagements(workerId: string, dto: EngagementFilterDto) {
    return this.engagementsRepository.getWorkerEngagements(workerId, dto);
  }

  getWorkerEngagementDetail(engagementId: string, workerId: string) {
    return this.engagementsRepository.getWorkerEngagementDetail(
      engagementId,
      workerId,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EMPLOYER
  // ─────────────────────────────────────────────────────────────────────────

  getEmployerEngagements(employerId: string, dto: EngagementFilterDto) {
    return this.engagementsRepository.getEmployerEngagements(employerId, dto);
  }

  getEmployerEngagementDetail(engagementId: string, employerId: string) {
    return this.engagementsRepository.getEmployerEngagementDetail(
      engagementId,
      employerId,
    );
  }

  async logShift(engagementId: string, employerId: string, dto: LogShiftDto) {
    if (dto.hoursWorked <= 0 || dto.hoursWorked > 24) {
      throw new BadRequestException('hoursWorked must be between 0 and 24');
    }

    const log = await this.engagementsRepository.logShift(
      engagementId,
      employerId,
      dto,
    );

    this.logger.log(
      `Shift logged for engagement ${engagementId}: ${dto.hoursWorked}h on ${dto.date}`,
    );

    return log;
  }

  getShiftLogs(engagementId: string, employerId: string) {
    return this.engagementsRepository.getShiftLogs(engagementId, employerId);
  }

  deleteShiftLog(shiftLogId: string, employerId: string) {
    return this.engagementsRepository.deleteShiftLog(shiftLogId, employerId);
  }

  async endEngagement(
    engagementId: string,
    employerId: string,
    dto: EndEngagementDto,
  ) {
    const updated = await this.engagementsRepository.endEngagement(
      engagementId,
      employerId,
      dto,
    );

    this.logger.log(
      `Engagement ${engagementId} ended by employer ${employerId}: ${dto.reason}`,
    );

    // TODO: notify worker of engagement end once NotificationService is wired
    return updated;
  }
}
