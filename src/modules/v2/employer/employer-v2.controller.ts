import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { FilesService } from '../../files/services/files.service';
import { EmployerV2Service } from './employer-v2.service';

@Controller('employer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.EMPLOYER)
export class EmployerV2Controller {
  constructor(
    private readonly employerService: EmployerV2Service,
    private readonly filesService: FilesService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: LocalAuthUser) {
    return this.employerService.me(user);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: LocalAuthUser) {
    return this.employerService.dashboard(user);
  }

  @Get('departments')
  departments(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.employerService.departments(user, query);
  }

  @Get('jobs')
  jobs(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.employerService.jobs(user, query);
  }

  @Post('jobs')
  createJob(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employerService.createJob(user, body);
  }

  @Patch('jobs/:jobId/status')
  updateJobStatus(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employerService.updateJobStatus(user, jobId, body);
  }

  @Post('jobs/:jobId/draft')
  saveDraft(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employerService.updateJob(user, jobId, body);
  }

  @Post('jobs/:jobId/publish')
  publishJob(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employerService.publishJob(user, jobId, body);
  }

  @Get('jobs/:jobId')
  jobDetail(@CurrentUser() user: LocalAuthUser, @Param('jobId') jobId: string) {
    return this.employerService.jobDetail(user, jobId);
  }

  @Patch('jobs/:jobId')
  updateJob(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employerService.updateJob(user, jobId, body);
  }

  @Delete('jobs/:jobId')
  deleteJob(@CurrentUser() user: LocalAuthUser, @Param('jobId') jobId: string) {
    return this.employerService.deleteJob(user, jobId);
  }

  @Get('applicants/filters')
  applicantFilters(@CurrentUser() user: LocalAuthUser) {
    return this.employerService.applicantFilters(user);
  }

  @Get('applicants')
  applicants(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.employerService.applicants(user, query);
  }

  @Get('applicants/:applicationId/share')
  shareApplicant(@Param('applicationId') applicationId: string) {
    return this.employerService.shareApplicant(applicationId);
  }

  @Patch('applicants/:applicationId/status')
  updateApplicantStatus(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employerService.updateApplicantStatus(
      user,
      applicationId,
      body,
    );
  }

  @Patch('applicants/:applicationId/notes')
  updateApplicantNotes(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employerService.updateApplicantNotes(user, applicationId, body);
  }

  @Get('applicants/:applicationId/files/:fileIndex/download')
  async downloadApplicantFile(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
    @Param('fileIndex', ParseIntPipe) fileIndex: number,
    @Res() res: Response,
  ) {
    const file = await this.employerService.downloadApplicantFile(
      user,
      applicationId,
      fileIndex,
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.buffer);
  }

  @Get('applicants/:applicationId')
  applicantDetail(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.employerService.applicantDetail(user, applicationId);
  }

  @Get('workforce')
  workforce(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.employerService.workforce(user, query);
  }

  @Patch('workforce/:workerId/status')
  updateWorkforceStatus(
    @CurrentUser() user: LocalAuthUser,
    @Param('workerId') workerId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employerService.updateWorkforceStatus(user, workerId, body);
  }

  @Get('workforce/:workerId')
  workforceDetail(
    @CurrentUser() user: LocalAuthUser,
    @Param('workerId') workerId: string,
  ) {
    return this.employerService.workforceDetail(user, workerId);
  }

  @Get('payments')
  paymentSummary(@CurrentUser() user: LocalAuthUser) {
    return this.employerService.paymentSummary(user);
  }

  @Get('payments/workers')
  paymentWorkers(@CurrentUser() user: LocalAuthUser) {
    return this.employerService.paymentWorkers(user);
  }

  @Post('payments/pay')
  payWorker(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employerService.payWorker(user, body);
  }

  @Get('payments/history')
  paymentHistory(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.employerService.paymentHistory(user, query);
  }

  @Get('payments/statement')
  paymentStatement(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.employerService.paymentHistory(user, query);
  }

  @Get('payments/:paymentId')
  paymentDetail(
    @CurrentUser() user: LocalAuthUser,
    @Param('paymentId') paymentId: string,
  ) {
    return this.employerService.paymentDetail(user, paymentId);
  }

  @Get('company')
  company(@CurrentUser() user: LocalAuthUser) {
    return this.employerService.company(user);
  }

  @Patch('company')
  updateCompany(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employerService.updateCompany(user, body);
  }

  @Post('company/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @CurrentUser() user: LocalAuthUser,
    @UploadedFile(
      new FileTypeValidationPipe({
        allowedMimeTypes: ALLOWED_MIME_TYPES.IMAGES,
        maxSizeBytes: MAX_FILE_SIZES.EMPLOYER_LOGO,
      }),
    )
    file: Express.Multer.File,
  ) {
    const uploaded = await this.filesService.uploadEmployerLogo(file, user.id);
    return this.employerService.uploadLogo(user, uploaded.secureUrl);
  }

  @Post('company/documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @CurrentUser() user: LocalAuthUser,
    @UploadedFile(
      new FileTypeValidationPipe({
        allowedMimeTypes: ALLOWED_MIME_TYPES.IMAGES_AND_DOCS,
        maxSizeBytes: MAX_FILE_SIZES.VERIFICATION_DOC,
      }),
    )
    file: Express.Multer.File,
    @Body('documentName') documentName?: string,
  ) {
    const uploaded = await this.filesService.uploadVerificationDocument(
      file,
      user.id,
      'business_reg',
    );
    return this.employerService.createDocument(
      user,
      file,
      uploaded.secureUrl,
      documentName,
    );
  }

  @Delete('company/documents/:documentId')
  deleteDocument(
    @CurrentUser() user: LocalAuthUser,
    @Param('documentId') documentId: string,
  ) {
    return this.employerService.deleteDocument(user, documentId);
  }

  @Get('informal-requests')
  informalRequests(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.employerService.informalRequests(user, query);
  }

  @Post('informal-requests')
  createInformalRequest(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employerService.createInformalRequest(user, body);
  }

  @Get('notifications')
  notifications(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.employerService.notifications(user, query);
  }

  @Patch('notifications/:notificationId/read')
  readNotification(
    @CurrentUser() user: LocalAuthUser,
    @Param('notificationId') notificationId: string,
  ) {
    return this.employerService.markNotificationRead(user, notificationId);
  }

  @Get('settings/notifications')
  notificationSettings(@CurrentUser() user: LocalAuthUser) {
    return this.employerService.notificationSettings(user);
  }

  @Patch('settings/notifications')
  updateNotificationSettings(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employerService.updateNotificationSettings(user, body);
  }

  @Patch('settings/language')
  updateLanguage(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employerService.updateLanguage(user, body);
  }
}
