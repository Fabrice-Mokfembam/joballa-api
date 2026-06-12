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
import { JobsService } from '../services/jobs.service';
import { JobSearchDto, ReportJobDto } from '../dto/jobs.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import { WorkersService } from '../../workers/services/workers.service';

/**
 * JobsController
 *
 * Worker routes  (base: /api/jobs):
 *   GET    /api/jobs                    — search + filter
 *   GET    /api/jobs/:jobId             — job detail
 *   POST   /api/jobs/:jobId/save        — save job
 *   DELETE /api/jobs/:jobId/save        — unsave job
 *   POST   /api/jobs/:jobId/hide        — hide from results
 *   DELETE /api/jobs/:jobId/hide        — unhide
 *   POST   /api/jobs/:jobId/report      — report job
 *   GET    /api/jobs/:jobId/share       — get shareable link
 *
 * Employer routes (base: /api/employer/jobs):
 *   POST   /api/employer/jobs           — create job
 *   GET    /api/employer/jobs           — list employer's jobs
 *   GET    /api/employer/jobs/:jobId    — job detail
 *   PATCH  /api/employer/jobs/:jobId    — update job
 *   PATCH  /api/employer/jobs/:jobId/status — change status
 *   DELETE /api/employer/jobs/:jobId    — delete job
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly workersService: WorkersService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — BROWSING
  // ─────────────────────────────────────────────────────────────────────────

  @Roles('WORKER')
  @Get('api/jobs')
  async searchJobs(
    @Query() dto: JobSearchDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.jobsService.searchJobs(dto, workerId);
  }

  @Roles('WORKER')
  @Get('api/jobs/:jobId')
  async getJobDetail(
    @Param('jobId') jobId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.jobsService.getJobDetail(jobId, workerId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — SAVE / UNSAVE
  // ─────────────────────────────────────────────────────────────────────────

  @Roles('WORKER')
  @Post('api/jobs/:jobId/save')
  @HttpCode(HttpStatus.OK)
  async saveJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.jobsService.saveJob(workerId, jobId);
  }

  @Roles('WORKER')
  @Delete('api/jobs/:jobId/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsaveJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.jobsService.unsaveJob(workerId, jobId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — HIDE / UNHIDE
  // ─────────────────────────────────────────────────────────────────────────

  @Roles('WORKER')
  @Post('api/jobs/:jobId/hide')
  @HttpCode(HttpStatus.OK)
  async hideJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.jobsService.hideJob(workerId, jobId);
  }

  @Roles('WORKER')
  @Delete('api/jobs/:jobId/hide')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unhideJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.jobsService.unhideJob(workerId, jobId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — REPORT
  // ─────────────────────────────────────────────────────────────────────────

  @Roles('WORKER')
  @Post('api/jobs/:jobId/report')
  @HttpCode(HttpStatus.CREATED)
  async reportJob(
    @Param('jobId') jobId: string,
    @Body() dto: ReportJobDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.jobsService.reportJob(workerId, jobId, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKER — SHARE
  // ─────────────────────────────────────────────────────────────────────────

  @Roles('WORKER')
  @Get('api/jobs/:jobId/share')
  getShareableLink(@Param('jobId') jobId: string) {
    return this.jobsService.getShareableLink(jobId);
  }
}
