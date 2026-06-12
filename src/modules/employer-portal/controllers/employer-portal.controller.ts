import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { FileTypeValidationPipe } from '../../../common/pipes/file-type-validation.pipe';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZES,
} from '../../files/files.constants';
import { CreateEmployerJobDto } from '../dto/create-employer-job.dto';
import { CreateShiftDto } from '../dto/create-shift.dto';
import { ListApplicantsQueryDto } from '../dto/list-applicants-query.dto';
import { ListEmployerJobsQueryDto } from '../dto/list-employer-jobs-query.dto';
import { ListWorkforceQueryDto } from '../dto/list-workforce-query.dto';
import { PayWorkerDto } from '../dto/pay-worker.dto';
import { PaymentHistoryQueryDto } from '../dto/payment-history-query.dto';
import { PaymentStatementQueryDto } from '../dto/payment-statement-query.dto';
import { PaymentsPeriodQueryDto } from '../dto/payments-query.dto';
import { UpdateApplicantStatusDto } from '../dto/update-applicant-status.dto';
import { UpdateApplicantNotesDto } from '../dto/update-applicant-notes.dto';
import { EmployerNotificationSettingsDto } from '../dto/employer-notification-settings.dto';
import { UpdateCompanyDto } from '../dto/update-company.dto';
import { UpdateEmployerJobDto } from '../dto/update-employer-job.dto';
import { UpdateJobStatusDto } from '../dto/update-job-status.dto';
import { UpdateShiftDto } from '../dto/update-shift.dto';
import { UpdateWorkforceStatusDto } from '../dto/update-workforce-status.dto';
import { EmployerApplicantsService } from '../services/employer-applicants.service';
import { EmployerCompanyService } from '../services/employer-company.service';
import { EmployerDashboardService } from '../services/employer-dashboard.service';
import { EmployerJobsService } from '../services/employer-jobs.service';
import { EmployerMeService } from '../services/employer-me.service';
import { EmployerPaymentsService } from '../services/employer-payments.service';
import { EmployerWorkforceService } from '../services/employer-workforce.service';
import { EmployerNotificationsService } from '../services/employer-notifications.service';

/** Employer portal API — base path `/api/employer`. */
@Controller('api/employer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.EMPLOYER)
export class EmployerPortalController {
  constructor(
    private readonly employerMeService: EmployerMeService,
    private readonly employerDashboardService: EmployerDashboardService,
    private readonly employerJobsService: EmployerJobsService,
    private readonly employerApplicantsService: EmployerApplicantsService,
    private readonly employerWorkforceService: EmployerWorkforceService,
    private readonly employerPaymentsService: EmployerPaymentsService,
    private readonly employerCompanyService: EmployerCompanyService,
    private readonly employerNotificationsService: EmployerNotificationsService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: LocalAuthUser) {
    return this.employerMeService.getMe(user);
  }

  @Get('dashboard')
  getDashboard(@CurrentUser() user: LocalAuthUser) {
    return this.employerDashboardService.getDashboard(user);
  }

  @Post('jobs')
  @HttpCode(HttpStatus.CREATED)
  createJob(
    @CurrentUser() user: LocalAuthUser,
    @Body() dto: CreateEmployerJobDto,
  ) {
    return this.employerJobsService.create(user, dto);
  }

  @Get('jobs')
  listJobs(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: ListEmployerJobsQueryDto,
  ) {
    return this.employerJobsService.list(user, query);
  }

  @Get('jobs/:jobId')
  getJob(@CurrentUser() user: LocalAuthUser, @Param('jobId') jobId: string) {
    return this.employerJobsService.getOne(user, jobId);
  }

  @Patch('jobs/:jobId')
  updateJob(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
    @Body() dto: UpdateEmployerJobDto,
  ) {
    return this.employerJobsService.update(user, jobId, dto);
  }

  @Patch('jobs/:jobId/status')
  updateJobStatus(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
    @Body() dto: UpdateJobStatusDto,
  ) {
    return this.employerJobsService.updateStatus(user, jobId, dto);
  }

  @Post('jobs/:jobId/draft')
  @HttpCode(HttpStatus.OK)
  saveJobDraft(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
    @Body() dto: UpdateEmployerJobDto,
  ) {
    return this.employerJobsService.saveDraft(user, jobId, dto);
  }

  @Delete('jobs/:jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteJob(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
  ) {
    await this.employerJobsService.remove(user, jobId);
  }

  @Get('applicants/filters')
  getApplicantFilters(@CurrentUser() user: LocalAuthUser) {
    return this.employerApplicantsService.filters(user);
  }

  @Get('applicants')
  listApplicants(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: ListApplicantsQueryDto,
  ) {
    return this.employerApplicantsService.list(user, query);
  }

  @Get('applicants/:applicationId/share')
  shareApplicant(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.employerApplicantsService.shareLink(user, applicationId);
  }

  @Get('applicants/:applicationId')
  getApplicant(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.employerApplicantsService.getOne(user, applicationId);
  }

  @Patch('applicants/:applicationId/status')
  updateApplicantStatus(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
    @Body() dto: UpdateApplicantStatusDto,
  ) {
    return this.employerApplicantsService.updateStatus(
      user,
      applicationId,
      dto,
    );
  }

  @Patch('applicants/:applicationId/notes')
  updateApplicantNotes(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
    @Body() dto: UpdateApplicantNotesDto,
  ) {
    return this.employerApplicantsService.updateNotes(user, applicationId, dto);
  }

  @Get('notifications')
  listNotifications(
    @CurrentUser() user: LocalAuthUser,
    @Query('filter') filter?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.employerNotificationsService.list(
      user.id,
      filter ?? 'all',
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Patch('notifications/:id/read')
  markNotificationRead(
    @CurrentUser() user: LocalAuthUser,
    @Param('id') id: string,
  ) {
    return this.employerNotificationsService.markRead(user.id, id);
  }

  @Patch('settings/notifications')
  updateNotificationSettings(
    @CurrentUser() user: LocalAuthUser,
    @Body() dto: EmployerNotificationSettingsDto,
  ) {
    return this.employerNotificationsService.saveSettings(user.id, dto);
  }

  @Get('workforce')
  listWorkforce(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: ListWorkforceQueryDto,
  ) {
    return this.employerWorkforceService.list(user, query);
  }

  @Get('workforce/:workerId/shifts')
  listShifts(
    @CurrentUser() user: LocalAuthUser,
    @Param('workerId') workerId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.employerWorkforceService.listShifts(
      user,
      workerId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }

  @Post('workforce/:workerId/shifts')
  @HttpCode(HttpStatus.CREATED)
  createShift(
    @CurrentUser() user: LocalAuthUser,
    @Param('workerId') workerId: string,
    @Body() dto: CreateShiftDto,
  ) {
    return this.employerWorkforceService.createShift(user, workerId, dto);
  }

  @Patch('workforce/:workerId/shifts/:shiftId')
  updateShift(
    @CurrentUser() user: LocalAuthUser,
    @Param('workerId') workerId: string,
    @Param('shiftId') shiftId: string,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.employerWorkforceService.updateShift(
      user,
      workerId,
      shiftId,
      dto,
    );
  }

  @Delete('workforce/:workerId/shifts/:shiftId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteShift(
    @CurrentUser() user: LocalAuthUser,
    @Param('workerId') workerId: string,
    @Param('shiftId') shiftId: string,
  ) {
    await this.employerWorkforceService.deleteShift(user, workerId, shiftId);
  }

  @Get('workforce/:workerId')
  getWorker(
    @CurrentUser() user: LocalAuthUser,
    @Param('workerId') workerId: string,
  ) {
    return this.employerWorkforceService.getWorker(user, workerId);
  }

  @Patch('workforce/:workerId/status')
  updateWorkforceStatus(
    @CurrentUser() user: LocalAuthUser,
    @Param('workerId') workerId: string,
    @Body() dto: UpdateWorkforceStatusDto,
  ) {
    return this.employerWorkforceService.updateWorkerStatus(
      user,
      workerId,
      dto,
    );
  }

  @Get('payments/statement')
  getPaymentStatement(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: PaymentStatementQueryDto,
  ) {
    return this.employerPaymentsService.getStatement(user, query);
  }

  @Get('payments/history')
  getPaymentHistory(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: PaymentHistoryQueryDto,
  ) {
    return this.employerPaymentsService.getHistory(user, query);
  }

  @Get('payments/workers')
  getPaymentWorkers(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: PaymentsPeriodQueryDto,
  ) {
    return this.employerPaymentsService.getWorkersTable(user, query);
  }

  @Post('payments/pay')
  @HttpCode(HttpStatus.CREATED)
  payWorker(@CurrentUser() user: LocalAuthUser, @Body() dto: PayWorkerDto) {
    return this.employerPaymentsService.payWorker(user, dto);
  }

  @Get('payments/:paymentId')
  getPayment(
    @CurrentUser() user: LocalAuthUser,
    @Param('paymentId') paymentId: string,
  ) {
    return this.employerPaymentsService.getPayment(user, paymentId);
  }

  @Get('payments')
  getPaymentsSummary(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: PaymentsPeriodQueryDto,
  ) {
    return this.employerPaymentsService.getSummary(user, query);
  }

  @Get('company')
  getCompany(@CurrentUser() user: LocalAuthUser) {
    return this.employerCompanyService.getCompany(user);
  }

  @Patch('company')
  updateCompany(
    @CurrentUser() user: LocalAuthUser,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.employerCompanyService.updateCompany(user, dto);
  }

  @Post('company/logo')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('logo', { storage: memoryStorage() }))
  uploadCompanyLogo(
    @CurrentUser() user: LocalAuthUser,
    @UploadedFile(
      new FileTypeValidationPipe({
        allowedMimeTypes: ALLOWED_MIME_TYPES.IMAGES,
        maxSizeBytes: MAX_FILE_SIZES.EMPLOYER_LOGO,
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.employerCompanyService.uploadLogo(user, file);
  }
}
