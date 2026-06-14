import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
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
import { WorkerCvExportService } from './worker-cv-export.service';
import { WorkerV2Service } from './worker-v2.service';

@Controller('worker')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.WORKER)
export class WorkerV2Controller {
  constructor(
    private readonly workerService: WorkerV2Service,
    private readonly cvExportService: WorkerCvExportService,
    private readonly filesService: FilesService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: LocalAuthUser) {
    return this.workerService.me(user);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: LocalAuthUser) {
    return this.workerService.dashboard(user);
  }

  @Get('departments')
  departments(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.departments(user, query);
  }

  @Get('posted-jobs')
  postedJobs(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.postedJobs(user, query);
  }

  @Post('posted-jobs')
  createPostedJob(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.createPostedJob(user, body);
  }

  @Get('posted-jobs/:jobId')
  postedJobDetail(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
  ) {
    return this.workerService.postedJobDetail(user, jobId);
  }

  @Patch('posted-jobs/:jobId')
  updatePostedJob(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updatePostedJob(user, jobId, body);
  }

  @Post('posted-jobs/:jobId/draft')
  savePostedJobDraft(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updatePostedJob(user, jobId, body);
  }

  @Post('posted-jobs/:jobId/publish')
  publishPostedJob(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.publishPostedJob(user, jobId, body);
  }

  @Delete('posted-jobs/:jobId')
  deletePostedJob(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
  ) {
    return this.workerService.deletePostedJob(user, jobId);
  }

  @Patch('posted-jobs/:jobId/status')
  updatePostedJobStatus(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updatePostedJobStatus(user, jobId, body);
  }

  @Get('applicants/filters')
  applicantFilters(@CurrentUser() user: LocalAuthUser) {
    return this.workerService.applicantFilters(user);
  }

  @Get('applicants')
  applicants(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.applicants(user, query);
  }

  @Patch('applicants/:applicationId/status')
  updateApplicantStatus(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updateApplicantStatus(user, applicationId, body);
  }

  @Patch('applicants/:applicationId/notes')
  updateApplicantNotes(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updateApplicantNotes(user, applicationId, body);
  }

  @Get('applicants/:applicationId/files/:fileIndex/download')
  async downloadApplicantFile(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
    @Param('fileIndex', ParseIntPipe) fileIndex: number,
    @Res() res: Response,
  ) {
    const file = await this.workerService.downloadApplicantFile(
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
    return this.workerService.applicantDetail(user, applicationId);
  }

  @Get('workforce')
  workforce(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.workforce(user, query);
  }

  @Patch('workforce/:workerId/status')
  updateWorkforceStatus(
    @CurrentUser() user: LocalAuthUser,
    @Param('workerId') workerId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updateWorkforceStatus(user, workerId, body);
  }

  @Get('workforce/:workerId')
  workforceDetail(
    @CurrentUser() user: LocalAuthUser,
    @Param('workerId') workerId: string,
  ) {
    return this.workerService.workforceDetail(user, workerId);
  }

  @Get('jobs')
  jobs(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.listJobs(user, query);
  }

  @Get('jobs/search')
  searchJobs(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.listJobs(user, query);
  }

  @Post('jobs/:jobId/save')
  saveJob(@CurrentUser() user: LocalAuthUser, @Param('jobId') jobId: string) {
    return this.workerService.saveJob(user, jobId, true);
  }

  @Delete('jobs/:jobId/save')
  unsaveJob(@CurrentUser() user: LocalAuthUser, @Param('jobId') jobId: string) {
    return this.workerService.saveJob(user, jobId, false);
  }

  @Post('jobs/:jobId/hide')
  hideJob(@CurrentUser() user: LocalAuthUser, @Param('jobId') jobId: string) {
    return this.workerService.hideJob(user, jobId, true);
  }

  @Delete('jobs/:jobId/hide')
  unhideJob(@CurrentUser() user: LocalAuthUser, @Param('jobId') jobId: string) {
    return this.workerService.hideJob(user, jobId, false);
  }

  @Post('jobs/:jobId/report')
  reportJob(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.reportJob(user, jobId, body);
  }

  @Get('jobs/:jobId/share')
  shareJob(@Param('jobId') jobId: string) {
    return this.workerService.shareJob(jobId);
  }

  @Post('jobs/:jobId/apply')
  apply(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.apply(user, jobId, body);
  }

  @Get('jobs/:jobId/application/profile')
  getApplicationProfile(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
  ) {
    return this.workerService.getApplicationProfile(user, jobId);
  }

  @Put('jobs/:jobId/application/profile')
  putApplicationProfile(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.upsertApplicationProfile(user, jobId, body);
  }

  @Post('jobs/:jobId/application/customize-profile')
  customizeApplicationProfile(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.customizeApplicationProfile(user, jobId, body);
  }

  /** Alias for GET /worker/applications — must be before jobs/:jobId */
  @Get('jobs/applications')
  jobsApplicationsAlias(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.applications(user, query);
  }

  @Get('jobs/applications/search')
  jobsApplicationsSearchAlias(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.applications(user, query);
  }

  @Get('jobs/applications/:applicationId')
  jobsApplicationDetailAlias(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.workerService.applicationDetail(user, applicationId);
  }

  @Delete('jobs/applications/:applicationId')
  jobsApplicationDeleteAlias(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.workerService.deleteApplication(user, applicationId);
  }

  @Get('jobs/:jobId')
  jobDetail(@CurrentUser() user: LocalAuthUser, @Param('jobId') jobId: string) {
    return this.workerService.jobDetail(user, jobId);
  }

  @Get('saved-jobs')
  savedJobs(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.savedJobs(user, query);
  }

  @Delete('saved-jobs/:jobId')
  removeSavedJob(
    @CurrentUser() user: LocalAuthUser,
    @Param('jobId') jobId: string,
  ) {
    return this.workerService.saveJob(user, jobId, false);
  }

  @Get('applications')
  applications(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.applications(user, query);
  }

  @Get('applications/search')
  searchApplications(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.applications(user, query);
  }

  @Get('applications/:applicationId/files/:fileIndex/download')
  async downloadApplicationFile(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
    @Param('fileIndex', ParseIntPipe) fileIndex: number,
    @Res() res: Response,
  ) {
    const file = await this.workerService.downloadApplicationFile(
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

  @Get('applications/:applicationId')
  applicationDetail(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.workerService.applicationDetail(user, applicationId);
  }

  @Delete('applications/:applicationId')
  deleteApplication(
    @CurrentUser() user: LocalAuthUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.workerService.deleteApplication(user, applicationId);
  }

  @Get('engagements')
  engagements(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.engagements(user, query);
  }

  @Get('engagements/:engagementId')
  engagementDetail(
    @CurrentUser() user: LocalAuthUser,
    @Param('engagementId') engagementId: string,
  ) {
    return this.workerService.engagementDetail(user, engagementId);
  }

  @Get('earnings/summary')
  earningsSummary(@CurrentUser() user: LocalAuthUser) {
    return this.workerService.earningsSummary(user);
  }

  @Get('earnings/transactions')
  earningsTransactions(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.earningsTransactions(user, query);
  }

  @Get('earnings/transactions/:transactionId')
  earningTransaction(
    @CurrentUser() user: LocalAuthUser,
    @Param('transactionId') transactionId: string,
  ) {
    return this.workerService.earningTransaction(user, transactionId);
  }

  @Get('earnings/statement')
  earningsStatement(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.earningsTransactions(user, query);
  }

  @Get('profile')
  profile(@CurrentUser() user: LocalAuthUser) {
    return this.workerService.profile(user);
  }

  @Put('profile')
  updateProfile(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updateProfile(user, body);
  }

  @Patch('profile/personal-info')
  personalInfo(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updateProfile(user, body);
  }

  @Patch('profile/professional-summary')
  professionalSummary(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updateProfile(user, body);
  }

  @Patch('profile/skills')
  skills(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updateProfile(user, body);
  }

  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async avatar(
    @CurrentUser() user: LocalAuthUser,
    @UploadedFile(
      new FileTypeValidationPipe({
        allowedMimeTypes: ALLOWED_MIME_TYPES.IMAGES,
        maxSizeBytes: MAX_FILE_SIZES.PROFILE_PHOTO,
      }),
    )
    file: Express.Multer.File,
  ) {
    const uploaded = await this.filesService.uploadProfilePhoto(file, user.id);
    return this.workerService.uploadAvatar(user, uploaded.secureUrl);
  }

  @Post('profile/cv')
  @UseInterceptors(FileInterceptor('file'))
  async cv(
    @CurrentUser() user: LocalAuthUser,
    @UploadedFile(
      new FileTypeValidationPipe({
        allowedMimeTypes: ALLOWED_MIME_TYPES.DOCUMENTS,
        maxSizeBytes: MAX_FILE_SIZES.RESUME,
      }),
    )
    file: Express.Multer.File,
  ) {
    const uploaded = await this.filesService.uploadResume(file, user.id);
    return this.workerService.uploadCv(user, uploaded.secureUrl);
  }

  @Get('profile/cv-export/status')
  cvExportStatus(@CurrentUser() user: LocalAuthUser) {
    return this.cvExportService.getStatus(user);
  }

  @Post('profile/cv-export')
  async generateCvExport(
    @CurrentUser() user: LocalAuthUser,
    @Res({ passthrough: false }) res: Response,
  ) {
    const pdf = await this.cvExportService.generateAndStore(user);
    res
      .status(201)
      .setHeader('Content-Type', 'application/pdf')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="${pdf.fileName}"`,
      )
      .setHeader('X-Joballa-Document-Id', pdf.documentId)
      .setHeader('X-Joballa-Generated-At', pdf.generatedAt)
      .send(pdf.buffer);
  }

  @Get('profile/cv-export')
  async downloadCvExport(
    @CurrentUser() user: LocalAuthUser,
    @Res({ passthrough: false }) res: Response,
  ) {
    const pdf = await this.cvExportService.downloadStored(user);
    res
      .status(200)
      .setHeader('Content-Type', 'application/pdf')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="${pdf.fileName}"`,
      )
      .send(pdf.buffer);
  }

  @Post('profile/work-history')
  createWork(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.createWorkExperience(user, body);
  }

  @Patch('profile/work-history/:workId')
  updateWork(
    @CurrentUser() user: LocalAuthUser,
    @Param('workId') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updateWorkExperience(user, id, body);
  }

  @Delete('profile/work-history/:workId')
  deleteWork(@CurrentUser() user: LocalAuthUser, @Param('workId') id: string) {
    return this.workerService.deleteOwned('workExperience', user, id);
  }

  @Post('profile/education')
  createEducation(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.createEducation(user, body);
  }

  @Patch('profile/education/:educationId')
  updateEducation(
    @CurrentUser() user: LocalAuthUser,
    @Param('educationId') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updateEducation(user, id, body);
  }

  @Delete('profile/education/:educationId')
  deleteEducation(
    @CurrentUser() user: LocalAuthUser,
    @Param('educationId') id: string,
  ) {
    return this.workerService.deleteOwned('education', user, id);
  }

  @Post('profile/certifications')
  createCertification(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.createCertification(user, body);
  }

  @Patch('profile/certifications/:certificationId')
  updateCertification(
    @CurrentUser() user: LocalAuthUser,
    @Param('certificationId') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updateCertification(user, id, body);
  }

  @Delete('profile/certifications/:certificationId')
  deleteCertification(
    @CurrentUser() user: LocalAuthUser,
    @Param('certificationId') id: string,
  ) {
    return this.workerService.deleteOwned('certification', user, id);
  }

  @Post('profile/documents')
  @UseInterceptors(FileInterceptor('file'))
  async createDocument(
    @CurrentUser() user: LocalAuthUser,
    @UploadedFile(
      new FileTypeValidationPipe({
        allowedMimeTypes: ALLOWED_MIME_TYPES.IMAGES_AND_DOCS,
        maxSizeBytes: MAX_FILE_SIZES.VERIFICATION_DOC,
      }),
    )
    file: Express.Multer.File,
    @Body('documentLabel') documentLabel?: string,
  ) {
    const uploaded = await this.filesService.uploadPortfolioDocument(
      file,
      user.id,
    );
    return this.workerService.createDocument(
      user,
      file,
      uploaded.secureUrl,
      documentLabel,
    );
  }

  @Get('profile/documents')
  listDocuments(@CurrentUser() user: LocalAuthUser) {
    return this.workerService.listDocuments(user);
  }

  @Delete('profile/documents/:documentId')
  deleteDocument(
    @CurrentUser() user: LocalAuthUser,
    @Param('documentId') id: string,
  ) {
    return this.workerService.deleteOwned('supportingDocument', user, id);
  }

  @Post('profile/kyc')
  submitKyc(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.submitKyc(user, body);
  }

  @Get('profile/kyc')
  kyc(@CurrentUser() user: LocalAuthUser) {
    return this.workerService.kycStatus(user);
  }

  @Get('profile/payment-accounts')
  listPaymentAccounts(@CurrentUser() user: LocalAuthUser) {
    return this.workerService.listPaymentAccounts(user);
  }

  @Post('profile/payment-accounts')
  createPaymentAccount(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.createPaymentAccount(user, body);
  }

  @Patch('profile/payment-accounts/:accountId')
  updatePaymentAccount(
    @CurrentUser() user: LocalAuthUser,
    @Param('accountId') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updatePaymentAccount(user, id, body);
  }

  @Delete('profile/payment-accounts/:accountId')
  deletePaymentAccount(
    @CurrentUser() user: LocalAuthUser,
    @Param('accountId') id: string,
  ) {
    return this.workerService.deleteOwned('workerPaymentAccount', user, id);
  }

  @Get('profile/:workerId/public')
  publicProfile(@Param('workerId') workerId: string) {
    return this.workerService.publicProfile(workerId);
  }

  @Get('informal-requests')
  informalRequests(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.informalRequests(user, query);
  }

  @Post('informal-requests')
  createInformalRequest(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.createInformalRequest(user, body);
  }

  @Get('notifications')
  notifications(
    @CurrentUser() user: LocalAuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.workerService.notifications(user, query);
  }

  @Get('notifications/unread-count')
  unreadNotificationCount(@CurrentUser() user: LocalAuthUser) {
    return this.workerService.unreadNotificationCount(user);
  }

  @Patch('notifications/read-all')
  markAllNotificationsRead(@CurrentUser() user: LocalAuthUser) {
    return this.workerService.markAllNotificationsRead(user);
  }

  @Patch('notifications/:notificationId/read')
  readNotification(
    @CurrentUser() user: LocalAuthUser,
    @Param('notificationId') id: string,
  ) {
    return this.workerService.markNotificationRead(user, id);
  }

  @Get('settings/notifications')
  notificationSettings(@CurrentUser() user: LocalAuthUser) {
    return this.workerService.notificationSettings(user);
  }

  @Patch('settings/notifications')
  updateNotificationSettings(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updateNotificationSettings(user, body);
  }

  @Patch('settings/language')
  updateLanguage(
    @CurrentUser() user: LocalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workerService.updateLanguage(user, body);
  }
}
