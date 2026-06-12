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
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import { WorkerJobsService } from '../services/worker-jobs.service';
import {
  WorkerCreateJobDto,
  WorkerIncomingApplicationsDto,
  WorkerJobFilterDto,
  WorkerJobStatusDto,
  WorkerUpdateJobDto,
} from '../dto/worker-jobs.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('WORKER')
@Controller('api/worker/jobs')
export class WorkerJobsController {
  constructor(private readonly workerJobs: WorkerJobsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createJob(
    @Body() dto: WorkerCreateJobDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workerJobs.createJob(user.id, dto);
  }

  @Get('applications')
  listIncomingApplications(
    @Query() dto: WorkerIncomingApplicationsDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workerJobs.listIncomingApplications(user.id, dto);
  }

  @Get('applications/:applicationId')
  getIncomingApplication(
    @Param('applicationId') applicationId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workerJobs.getIncomingApplication(user.id, applicationId);
  }

  @Get()
  listJobs(
    @Query() dto: WorkerJobFilterDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workerJobs.listMyJobs(user.id, dto);
  }

  @Get(':jobId')
  getJob(@Param('jobId') jobId: string, @CurrentUser() user: LocalAuthUser) {
    return this.workerJobs.getJob(user.id, jobId);
  }

  @Patch(':jobId/status')
  updateStatus(
    @Param('jobId') jobId: string,
    @Body() dto: WorkerJobStatusDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workerJobs.updateJobStatus(user.id, jobId, dto);
  }

  @Patch(':jobId')
  updateJob(
    @Param('jobId') jobId: string,
    @Body() dto: WorkerUpdateJobDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workerJobs.updateJob(user.id, jobId, dto);
  }

  @Delete(':jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteJob(@Param('jobId') jobId: string, @CurrentUser() user: LocalAuthUser) {
    return this.workerJobs.deleteJob(user.id, jobId);
  }
}
