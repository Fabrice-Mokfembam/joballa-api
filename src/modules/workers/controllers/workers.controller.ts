import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { WorkersService } from '../services/workers.service';
import {
  UpdatePersonalInfoDto,
  UpdateProfessionalSummaryDto,
  UpdateSkillsDto,
  CreateWorkHistoryDto,
  UpdateWorkHistoryDto,
  CreateEducationDto,
  UpdateEducationDto,
  CreateCertificationDto,
  UpdateCertificationDto,
  UpdatePaymentDetailsDto,
  SubmitKYCDto,
  UpsertWorkerProfileDto,
  CreatePaymentAccountDto,
  UpdatePaymentAccountDto,
} from '../dto/workers.dto';
import { FilesService } from '../../files/services/files.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { FileTypeValidationPipe } from '../../../common/pipes/file-type-validation.pipe';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';

/**
 * WorkersController
 *
 * Base path: /api/worker
 * All routes require: JWT auth + WORKER role
 *
 * Route map:
 *   GET    /api/worker/me
 *   GET    /api/worker/profile
 *   GET    /api/worker/profile/:workerId/public
 *   PATCH  /api/worker/profile/personal-info
 *   PATCH  /api/worker/profile/professional-summary
 *   PATCH  /api/worker/profile/skills
 *   POST   /api/worker/profile/avatar
 *   POST   /api/worker/profile/work-history
 *   PATCH  /api/worker/profile/work-history/:workId
 *   DELETE /api/worker/profile/work-history/:workId
 *   POST   /api/worker/profile/education
 *   PATCH  /api/worker/profile/education/:educationId
 *   DELETE /api/worker/profile/education/:educationId
 *   POST   /api/worker/profile/certifications
 *   PATCH  /api/worker/profile/certifications/:certId
 *   DELETE /api/worker/profile/certifications/:certId
 *   POST   /api/worker/profile/documents
 *   GET    /api/worker/profile/documents
 *   DELETE /api/worker/profile/documents/:documentId
 *   POST   /api/worker/profile/kyc
 *   GET    /api/worker/profile/kyc
 *   PATCH  /api/worker/profile/payment-details
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('WORKER')
@Controller('api/worker')
export class WorkersController {
  constructor(
    private readonly workersService: WorkersService,
    private readonly filesService: FilesService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // ME
  // ─────────────────────────────────────────────────────────────────────────

  @Get('me')
  getMe(@CurrentUser() user: LocalAuthUser) {
    return this.workersService.getMe(user.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROFILE
  // ─────────────────────────────────────────────────────────────────────────

  @Get('profile')
  getFullProfile(@CurrentUser() user: LocalAuthUser) {
    return this.workersService.getFullProfile(user.id);
  }

  @Put('profile')
  putProfile(
    @Body() dto: UpsertWorkerProfileDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.putProfile(user.id, dto);
  }

  /**
   * GET /api/worker/profile/:workerId/public
   * Returns the public-facing profile of any worker by their WorkerProfile ID.
   * Sensitive fields (payment details, KYC, documents) are excluded.
   */
  @Get('profile/:workerId/public')
  getPublicProfile(@Param('workerId') workerId: string) {
    return this.workersService.getPublicProfile(workerId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PERSONAL INFO
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * PATCH /api/worker/profile/personal-info
   * Updates name, location, languages, availability status.
   * Automatically recomputes profile completeness after update.
   */
  @Patch('profile/personal-info')
  updatePersonalInfo(
    @Body() dto: UpdatePersonalInfoDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.updatePersonalInfo(user.id, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROFESSIONAL SUMMARY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * PATCH /api/worker/profile/professional-summary
   * Updates professional title, bio, industries, preferred job types.
   */
  @Patch('profile/professional-summary')
  updateProfessionalSummary(
    @Body() dto: UpdateProfessionalSummaryDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.updateProfessionalSummary(user.id, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SKILLS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * PATCH /api/worker/profile/skills
   * Replaces the full skills array. Send the complete desired skills list.
   */
  @Patch('profile/skills')
  updateSkills(
    @Body() dto: UpdateSkillsDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.updateSkills(user.id, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AVATAR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/worker/profile/avatar
   * Uploads a profile photo. Accepts multipart/form-data with field 'file'.
   * File is validated (JPEG/PNG/WEBP, max 5MB) before being uploaded to Cloudinary.
   * The returned secureUrl is saved on the worker profile.
   *
   * Note: full Cloudinary upload is handled by FilesService — wire it in here
   * once FilesModule is imported into WorkersModule.
   */
  @Post('profile/avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadAvatar(
    @UploadedFile(
      new FileTypeValidationPipe({
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        maxSizeBytes: 5 * 1024 * 1024,
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const uploaded = await this.filesService.uploadProfilePhoto(file, user.id);
    return this.workersService.updateAvatar(user.id, uploaded.secureUrl);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORK HISTORY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/worker/profile/work-history
   */
  @Post('profile/work-history')
  @HttpCode(HttpStatus.CREATED)
  createWorkHistory(
    @Body() dto: CreateWorkHistoryDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.createWorkHistory(user.id, dto);
  }

  /**
   * PATCH /api/worker/profile/work-history/:workId
   */
  @Patch('profile/work-history/:workId')
  updateWorkHistory(
    @Param('workId') workId: string,
    @Body() dto: UpdateWorkHistoryDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.updateWorkHistory(user.id, workId, dto);
  }

  /**
   * DELETE /api/worker/profile/work-history/:workId
   */
  @Delete('profile/work-history/:workId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWorkHistory(
    @Param('workId') workId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.deleteWorkHistory(user.id, workId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EDUCATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/worker/profile/education
   */
  @Post('profile/education')
  @HttpCode(HttpStatus.CREATED)
  createEducation(
    @Body() dto: CreateEducationDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.createEducation(user.id, dto);
  }

  /**
   * PATCH /api/worker/profile/education/:educationId
   */
  @Patch('profile/education/:educationId')
  updateEducation(
    @Param('educationId') educationId: string,
    @Body() dto: UpdateEducationDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.updateEducation(user.id, educationId, dto);
  }

  /**
   * DELETE /api/worker/profile/education/:educationId
   */
  @Delete('profile/education/:educationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEducation(
    @Param('educationId') educationId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.deleteEducation(user.id, educationId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CERTIFICATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/worker/profile/certifications
   */
  @Post('profile/certifications')
  @HttpCode(HttpStatus.CREATED)
  createCertification(
    @Body() dto: CreateCertificationDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.createCertification(user.id, dto);
  }

  /**
   * PATCH /api/worker/profile/certifications/:certId
   */
  @Patch('profile/certifications/:certId')
  updateCertification(
    @Param('certId') certId: string,
    @Body() dto: UpdateCertificationDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.updateCertification(user.id, certId, dto);
  }

  /**
   * DELETE /api/worker/profile/certifications/:certId
   */
  @Delete('profile/certifications/:certId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCertification(
    @Param('certId') certId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.deleteCertification(user.id, certId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOCUMENTS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/worker/profile/documents
   * Upload a CV, portfolio, or certificate document.
   * Accepts multipart/form-data with field 'file'.
   * Query param: ?type=CV|CERTIFICATE|PORTFOLIO|OTHER
   *
   * TODO: wire FilesService.uploadPortfolioDocument() here.
   */
  @Post('profile/documents')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadDocument(
    @UploadedFile(
      new FileTypeValidationPipe({
        allowedMimeTypes: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/pdf',
        ],
        maxSizeBytes: 10 * 1024 * 1024,
      }),
    )
    file: Express.Multer.File,
    @Query('type') type: string = 'OTHER',
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    const uploaded = await this.filesService.uploadPortfolioDocument(
      file,
      workerId,
    );
    return this.workersService.uploadDocument(
      user.id,
      uploaded.secureUrl,
      file.originalname,
      type,
      file.mimetype,
      file.size,
    );
  }

  /**
   * GET /api/worker/profile/documents
   */
  @Get('profile/documents')
  getDocuments(@CurrentUser() user: LocalAuthUser) {
    return this.workersService.getDocuments(user.id);
  }

  /**
   * DELETE /api/worker/profile/documents/:documentId
   */
  @Delete('profile/documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.deleteDocument(user.id, documentId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KYC
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/worker/profile/kyc
   * Submit identity verification documents.
   * Expects Cloudinary URLs — upload images via /files/verification-doc first.
   */
  @Post('profile/kyc')
  @HttpCode(HttpStatus.CREATED)
  submitKYC(@Body() dto: SubmitKYCDto, @CurrentUser() user: LocalAuthUser) {
    return this.workersService.submitKYC(user.id, dto);
  }

  /**
   * GET /api/worker/profile/kyc
   * Returns the most recent KYC submission and its status.
   */
  @Get('profile/kyc')
  getKYCStatus(@CurrentUser() user: LocalAuthUser) {
    return this.workersService.getKYCStatus(user.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAYMENT DETAILS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * PATCH /api/worker/profile/payment-details
   * Updates mobile money and/or bank account details.
   */
  @Patch('profile/payment-details')
  updatePaymentDetails(
    @Body() dto: UpdatePaymentDetailsDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.updatePaymentDetails(user.id, dto);
  }

  @Get('profile/payment-accounts')
  listPaymentAccounts(@CurrentUser() user: LocalAuthUser) {
    return this.workersService.listPaymentAccounts(user.id);
  }

  @Post('profile/payment-accounts')
  @HttpCode(HttpStatus.CREATED)
  createPaymentAccount(
    @Body() dto: CreatePaymentAccountDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.createPaymentAccount(user.id, dto);
  }

  @Patch('profile/payment-accounts/:accountId')
  updatePaymentAccount(
    @Param('accountId') accountId: string,
    @Body() dto: UpdatePaymentAccountDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.updatePaymentAccount(user.id, accountId, dto);
  }

  @Delete('profile/payment-accounts/:accountId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePaymentAccount(
    @Param('accountId') accountId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.workersService.deletePaymentAccount(user.id, accountId);
  }
}
