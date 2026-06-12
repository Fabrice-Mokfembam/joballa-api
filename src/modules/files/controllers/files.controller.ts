import {
  Controller,
  Post,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FilesService } from '../services/files.service';
import { CloudinaryUploadResult } from '../services/files.service';
import { FileTypeValidationPipe } from '../../../common/pipes/file-type-validation.pipe';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZES } from '../files.constants';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard) // Protect all routes in this controller
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // ──────────────────────────────────
  // POST /upload/profile-photo/:userId
  // ──────────────────────────────────
  @Post('profile-photo/:userId')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadProfilePhoto(
    @Param('userId') userId: string,
    @UploadedFile(
      new FileTypeValidationPipe({
        allowedMimeTypes: ALLOWED_MIME_TYPES.IMAGES,
        maxSizeBytes: MAX_FILE_SIZES.PROFILE_PHOTO,
      }),
    )
    file: Express.Multer.File,
  ): Promise<CloudinaryUploadResult> {
    return this.filesService.uploadProfilePhoto(file, userId);
  }

  // POST /files/verification-doc — current user (worker KYC flow)
  @Post('verification-doc')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadVerificationDocForMe(
    @CurrentUser() user: LocalAuthUser,
    @Query('docType') docType: 'national_id' | 'business_reg' = 'national_id',
    @UploadedFile(
      new FileTypeValidationPipe({
        allowedMimeTypes: ALLOWED_MIME_TYPES.IMAGES_AND_DOCS,
        maxSizeBytes: MAX_FILE_SIZES.VERIFICATION_DOC,
      }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.filesService.uploadVerificationDocument(
      file,
      user.id,
      docType,
    );
    return { url: result.secureUrl, secureUrl: result.secureUrl };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /upload/verification-doc/:userId?docType=national_id|business_reg
  // ─────────────────────────────────────────────────────────────────────────
  @Post('verification-doc/:userId')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadVerificationDoc(
    @Param('userId') userId: string,
    @Query('docType') docType: 'national_id' | 'business_reg' = 'national_id',
    @UploadedFile(
      new FileTypeValidationPipe({
        allowedMimeTypes: ALLOWED_MIME_TYPES.IMAGES_AND_DOCS,
        maxSizeBytes: MAX_FILE_SIZES.VERIFICATION_DOC,
      }),
    )
    file: Express.Multer.File,
  ): Promise<CloudinaryUploadResult> {
    return this.filesService.uploadVerificationDocument(file, userId, docType);
  }

  // ───────────────────────────────────────
  // POST /upload/employer-logo/:employerId
  // ───────────────────────────────────────
  @Post('employer-logo/:employerId')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadEmployerLogo(
    @Param('employerId') employerId: string,
    @UploadedFile(
      new FileTypeValidationPipe({
        allowedMimeTypes: ALLOWED_MIME_TYPES.IMAGES,
        maxSizeBytes: MAX_FILE_SIZES.EMPLOYER_LOGO,
      }),
    )
    file: Express.Multer.File,
  ): Promise<CloudinaryUploadResult> {
    return this.filesService.uploadEmployerLogo(file, employerId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /upload/job-attachment/:jobId
  // ─────────────────────────────────────────────────────────────────────────
  @Post('job-attachment/:jobId')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadJobAttachment(
    @Param('jobId') jobId: string,
    @UploadedFile(
      new FileTypeValidationPipe({
        allowedMimeTypes: ALLOWED_MIME_TYPES.DOCUMENTS,
        maxSizeBytes: MAX_FILE_SIZES.JOB_ATTACHMENT,
      }),
    )
    file: Express.Multer.File,
  ): Promise<CloudinaryUploadResult> {
    return this.filesService.uploadJobAttachment(file, jobId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /upload/portfolio/:workerId
  // ─────────────────────────────────────────────────────────────────────────
  @Post('portfolio/:workerId')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadPortfolio(
    @Param('workerId') workerId: string,
    @UploadedFile(
      new FileTypeValidationPipe({
        allowedMimeTypes: ALLOWED_MIME_TYPES.IMAGES_AND_DOCS,
        maxSizeBytes: MAX_FILE_SIZES.JOB_ATTACHMENT,
      }),
    )
    file: Express.Multer.File,
  ): Promise<CloudinaryUploadResult> {
    return this.filesService.uploadPortfolioDocument(file, workerId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /upload/resume/:workerId
  // ─────────────────────────────────────────────────────────────────────────
  @Post('resume/:workerId')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadResume(
    @Param('workerId') workerId: string,
    @UploadedFile(
      new FileTypeValidationPipe({
        allowedMimeTypes: ALLOWED_MIME_TYPES.DOCUMENTS,
        maxSizeBytes: MAX_FILE_SIZES.RESUME,
      }),
    )
    file: Express.Multer.File,
  ): Promise<CloudinaryUploadResult> {
    return this.filesService.uploadResume(file, workerId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /upload/:publicId?resourceType=image|raw
  // ─────────────────────────────────────────────────────────────────────────
  @Delete(':publicId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFile(
    @Param('publicId') publicId: string,
    @Query('resourceType') resourceType: 'image' | 'video' | 'raw' = 'image',
  ): Promise<void> {
    return this.filesService.deleteFile(publicId, resourceType);
  }
}
