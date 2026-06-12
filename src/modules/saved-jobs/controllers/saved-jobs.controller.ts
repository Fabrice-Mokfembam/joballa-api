import {
  Controller,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SavedJobsService } from '../services/saved-jobs.service';
import { BulkDeleteSavedJobsDto } from '../dto/saved-jobs.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import { WorkersService } from '../../workers/services/workers.service';

/**
 * SavedJobsController
 *
 *   GET    /api/saved-jobs              — list saved jobs
 *   DELETE /api/saved-jobs/:jobId       — remove one saved job
 *   DELETE /api/saved-jobs              — bulk remove saved jobs
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('WORKER')
@Controller('api/saved-jobs')
export class SavedJobsController {
  constructor(
    private readonly savedJobsService: SavedJobsService,
    private readonly workersService: WorkersService,
  ) {}

  @Get()
  async getSavedJobs(
    @CurrentUser() user: LocalAuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.savedJobsService.getSavedJobs(workerId, page, limit);
  }

  @Delete(':jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSavedJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.savedJobsService.deleteSavedJob(workerId, jobId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async bulkDeleteSavedJobs(
    @Body() dto: BulkDeleteSavedJobsDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.savedJobsService.deleteSavedJobsInBulk(workerId, dto.jobIds);
  }
}
