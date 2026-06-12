import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApplicationsService } from '../services/applications.service';
import {
  CustomizeProfileDto,
  SubmitApplicationDto,
  ApplicationFilterDto,
  UpdateApplicationStatusDto,
} from '../dto/applications.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import { WorkersService } from '../../workers/services/workers.service';

const TEMP_EMPLOYER_ID = 'TEMP_EMPLOYER_ID';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
    private readonly workersService: WorkersService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — CUSTOMIZE PROFILE FOR A SPECIFIC JOB (pre-apply step)
  // ─────────────────────────────────────────────────────────────────────────

  @Roles('WORKER')
  @Post('api/jobs/:jobId/application/customize-profile')
  @HttpCode(HttpStatus.OK)
  async customizeProfile(
    @Param('jobId') jobId: string,
    @Body() dto: CustomizeProfileDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.applicationsService.customizeProfile(workerId, jobId, dto);
  }

  @Roles('WORKER')
  @Post('api/jobs/:jobId/apply')
  @HttpCode(HttpStatus.CREATED)
  async submitApplication(
    @Param('jobId') jobId: string,
    @Body() dto: SubmitApplicationDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.applicationsService.submitApplication(workerId, jobId, dto);
  }

  @Roles('WORKER')
  @Get('api/applications')
  async getWorkerApplications(
    @Query() dto: ApplicationFilterDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.applicationsService.getWorkerApplications(workerId, dto);
  }

  @Roles('WORKER')
  @Get('api/applications/:applicationId')
  async getWorkerApplicationDetail(
    @Param('applicationId') applicationId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.applicationsService.getWorkerApplicationDetail(
      applicationId,
      workerId,
    );
  }

  @Roles('WORKER')
  @Delete('api/applications/:applicationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archiveApplication(
    @Param('applicationId') applicationId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.applicationsService.archiveApplication(applicationId, workerId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EMPLOYER — APPLICANT REVIEW
  // ─────────────────────────────────────────────────────────────────────────

  @Roles('EMPLOYER')
  @Get('api/employer/jobs/:jobId/applicants')
  getJobApplicants(
    @Param('jobId') jobId: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.applicationsService.getJobApplicants(
      jobId,
      TEMP_EMPLOYER_ID,
      status,
      page,
      limit,
    );
  }

  @Roles('EMPLOYER')
  @Patch('api/employer/applications/:applicationId/status')
  updateApplicationStatus(
    @Param('applicationId') applicationId: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.applicationsService.updateApplicationStatus(
      applicationId,
      TEMP_EMPLOYER_ID,
      dto,
    );
  }
}
