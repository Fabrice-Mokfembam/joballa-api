import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EngagementsService } from '../services/engagements.service';
import {
  LogShiftDto,
  EndEngagementDto,
  EngagementFilterDto,
} from '../dto/engagements.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import { WorkersService } from '../../workers/services/workers.service';

const TEMP_EMPLOYER_ID = 'TEMP_EMPLOYER_ID';

/**
 * EngagementsController
 *
 * Worker routes:
 *   GET /api/worker/engagements
 *   GET /api/worker/engagements/:engagementId
 *
 * Employer routes:
 *   GET    /api/employer/engagements
 *   GET    /api/employer/engagements/:engagementId
 *   POST   /api/employer/engagements/:engagementId/shift-logs
 *   GET    /api/employer/engagements/:engagementId/shift-logs
 *   DELETE /api/employer/engagements/:engagementId/shift-logs/:shiftLogId
 *   POST   /api/employer/engagements/:engagementId/end
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class EngagementsController {
  constructor(
    private readonly engagementsService: EngagementsService,
    private readonly workersService: WorkersService,
  ) {}

  @Roles('WORKER')
  @Get('api/worker/engagements')
  async getWorkerEngagements(
    @Query() dto: EngagementFilterDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.engagementsService.getWorkerEngagements(workerId, dto);
  }

  @Roles('WORKER')
  @Get('api/worker/engagements/:engagementId')
  async getWorkerEngagementDetail(
    @Param('engagementId') engagementId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.engagementsService.getWorkerEngagementDetail(
      engagementId,
      workerId,
    );
  }

  @Roles('EMPLOYER')
  @Get('api/employer/engagements')
  getEmployerEngagements(@Query() dto: EngagementFilterDto) {
    return this.engagementsService.getEmployerEngagements(
      TEMP_EMPLOYER_ID,
      dto,
    );
  }

  @Roles('EMPLOYER')
  @Get('api/employer/engagements/:engagementId')
  getEmployerEngagementDetail(@Param('engagementId') engagementId: string) {
    return this.engagementsService.getEmployerEngagementDetail(
      engagementId,
      TEMP_EMPLOYER_ID,
    );
  }

  @Roles('EMPLOYER')
  @Post('api/employer/engagements/:engagementId/shift-logs')
  @HttpCode(HttpStatus.CREATED)
  logShift(
    @Param('engagementId') engagementId: string,
    @Body() dto: LogShiftDto,
  ) {
    return this.engagementsService.logShift(
      engagementId,
      TEMP_EMPLOYER_ID,
      dto,
    );
  }

  @Roles('EMPLOYER')
  @Get('api/employer/engagements/:engagementId/shift-logs')
  getShiftLogs(@Param('engagementId') engagementId: string) {
    return this.engagementsService.getShiftLogs(engagementId, TEMP_EMPLOYER_ID);
  }

  @Roles('EMPLOYER')
  @Delete('api/employer/engagements/:engagementId/shift-logs/:shiftLogId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteShiftLog(
    @Param('engagementId') engagementId: string,
    @Param('shiftLogId') shiftLogId: string,
  ) {
    return this.engagementsService.deleteShiftLog(shiftLogId, TEMP_EMPLOYER_ID);
  }

  @Roles('EMPLOYER')
  @Post('api/employer/engagements/:engagementId/end')
  @HttpCode(HttpStatus.OK)
  endEngagement(
    @Param('engagementId') engagementId: string,
    @Body() dto: EndEngagementDto,
  ) {
    return this.engagementsService.endEngagement(
      engagementId,
      TEMP_EMPLOYER_ID,
      dto,
    );
  }
}
