import {
  Injectable,
  Inject,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import * as streamifier from 'streamifier';
import { CLOUDINARY_FOLDERS, MAX_GENERATED_CV_BYTES } from '../files.constants';
import { CLOUDINARY } from '../cloudinary.provider';

export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  resourceType: string;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @Inject(CLOUDINARY) private readonly cloudinaryClient: typeof cloudinary,
  ) {}

  // ───────────────────────────────────────────────────────────
  // Core private upload method — streams a buffer to Cloudinary
  // ───────────────────────────────────────────────────────────

  private uploadStream(
    buffer: Buffer,
    options: Record<string, unknown>,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinaryClient.uploader.upload_stream(
        options,
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error)
            return reject(
              new Error(error.message || 'Cloudinary upload failed'),
            );
          if (!result)
            return reject(new Error('No result returned from Cloudinary'));
          resolve(result);
        },
      );

      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  private mapResult(result: UploadApiResponse): CloudinaryUploadResult {
    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      format: result.format,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
      resourceType: result.resource_type,
    };
  }

  // ─────────────────────────────────────────────────────────
  // 1. Worker profile photo
  //    - Resized to 400×400, face-crop, auto quality & format
  // ─────────────────────────────────────────────────────────

  async uploadProfilePhoto(
    file: Express.Multer.File,
    userId: string,
  ): Promise<CloudinaryUploadResult> {
    try {
      const result = await this.uploadStream(file.buffer, {
        folder: CLOUDINARY_FOLDERS.PROFILE_PHOTOS,
        public_id: `worker_${userId}`,
        overwrite: true, // replaces existing photo on update
        resource_type: 'image',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { fetch_format: 'auto', quality: 'auto' },
        ],
      });

      this.logger.log(
        `Profile photo uploaded for user ${userId}: ${result.secure_url}`,
      );
      return this.mapResult(result);
    } catch (error) {
      this.logger.error(
        `Failed to upload profile photo for user ${userId}`,
        error,
      );
      throw new InternalServerErrorException('Profile photo upload failed');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Verification documents (National ID, business registration)
  //    - PDFs and images accepted
  //    - Stored in a private access-controlled folder
  // ─────────────────────────────────────────────────────────────────────────────

  async uploadVerificationDocument(
    file: Express.Multer.File,
    userId: string,
    docType: 'national_id' | 'business_reg',
  ): Promise<CloudinaryUploadResult> {
    const isImage = file.mimetype.startsWith('image/');

    try {
      const result = await this.uploadStream(file.buffer, {
        folder: CLOUDINARY_FOLDERS.VERIFICATION_DOCS,
        public_id: `${docType}_${userId}_${Date.now()}`,
        resource_type: isImage ? 'image' : 'raw',
        // 'authenticated' type restricts direct public access
        type: 'authenticated',
        tags: [userId, docType, 'verification'],
      });

      this.logger.log(
        `Verification doc (${docType}) uploaded for user ${userId}`,
      );
      return this.mapResult(result);
    } catch (error) {
      this.logger.error(
        `Verification doc upload failed for user ${userId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Verification document upload failed',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Employer logo
  //    - Max 2 MB, resized to 300×300, transparent background preserved
  // ─────────────────────────────────────────────────────────────────────────────

  async uploadEmployerLogo(
    file: Express.Multer.File,
    employerId: string,
  ): Promise<CloudinaryUploadResult> {
    try {
      const result = await this.uploadStream(file.buffer, {
        folder: CLOUDINARY_FOLDERS.EMPLOYER_LOGOS,
        public_id: `logo_${employerId}`,
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { width: 300, height: 300, crop: 'pad', background: 'white' },
          { fetch_format: 'auto', quality: 'auto' },
        ],
      });

      this.logger.log(`Employer logo uploaded for employer ${employerId}`);
      return this.mapResult(result);
    } catch (error) {
      this.logger.error(
        `Employer logo upload failed for employer ${employerId}`,
        error,
      );
      throw new InternalServerErrorException('Employer logo upload failed');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Job attachment (requested by employer during job posting)
  //    - PDFs only
  // ─────────────────────────────────────────────────────────────────────────────

  async uploadJobAttachment(
    file: Express.Multer.File,
    jobId: string,
  ): Promise<CloudinaryUploadResult> {
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Job attachments must be PDF files');
    }

    try {
      const result = await this.uploadStream(file.buffer, {
        folder: CLOUDINARY_FOLDERS.JOB_ATTACHMENTS,
        public_id: `job_${jobId}_${Date.now()}`,
        resource_type: 'raw',
        tags: [jobId, 'job-attachment'],
      });

      this.logger.log(`Job attachment uploaded for job ${jobId}`);
      return this.mapResult(result);
    } catch (error) {
      this.logger.error(`Job attachment upload failed for job ${jobId}`, error);
      throw new InternalServerErrorException('Job attachment upload failed');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Worker portfolio / supporting documents (optional, added to applications)
  // ─────────────────────────────────────────────────────────────────────────────

  async uploadPortfolioDocument(
    file: Express.Multer.File,
    workerId: string,
  ): Promise<CloudinaryUploadResult> {
    const isImage = file.mimetype.startsWith('image/');

    try {
      const result = await this.uploadStream(file.buffer, {
        folder: CLOUDINARY_FOLDERS.PORTFOLIO_DOCS,
        public_id: `portfolio_${workerId}_${Date.now()}`,
        resource_type: isImage ? 'image' : 'raw',
        tags: [workerId, 'portfolio'],
      });

      this.logger.log(`Portfolio document uploaded for worker ${workerId}`);
      return this.mapResult(result);
    } catch (error) {
      this.logger.error(
        `Portfolio upload failed for worker ${workerId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Portfolio document upload failed',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Resume / CV upload (used by AI to prefill worker profile fields)
  // ─────────────────────────────────────────────────────────────────────────────

  async uploadResume(
    file: Express.Multer.File,
    workerId: string,
  ): Promise<CloudinaryUploadResult> {
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Resume must be a PDF file');
    }

    try {
      const result = await this.uploadStream(file.buffer, {
        folder: CLOUDINARY_FOLDERS.RESUME_UPLOADS,
        public_id: `resume_${workerId}`,
        overwrite: true, // only keep the latest resume
        resource_type: 'raw',
        tags: [workerId, 'resume'],
      });

      this.logger.log(`Resume uploaded for worker ${workerId}`);
      return this.mapResult(result);
    } catch (error) {
      this.logger.error(`Resume upload failed for worker ${workerId}`, error);
      throw new InternalServerErrorException('Resume upload failed');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Joballa-generated worker CV export (profile → PDF, persisted)
  // ─────────────────────────────────────────────────────────────────────────────

  async uploadGeneratedCvExport(
    buffer: Buffer,
    workerId: string,
    documentId: string,
  ): Promise<CloudinaryUploadResult> {
    if (buffer.length === 0 || buffer.length > MAX_GENERATED_CV_BYTES) {
      throw new BadRequestException('Generated CV exceeds allowed size.');
    }

    try {
      const result = await this.uploadStream(buffer, {
        folder: CLOUDINARY_FOLDERS.GENERATED_CV_EXPORTS,
        public_id: `generated_cv_${workerId}_${documentId}`,
        overwrite: true,
        resource_type: 'raw',
        format: 'pdf',
        tags: [workerId, 'generated-cv'],
      });

      this.logger.log(`Generated CV uploaded for worker ${workerId}`);
      return this.mapResult(result);
    } catch (error) {
      this.logger.error(
        `Generated CV upload failed for worker ${workerId}`,
        error,
      );
      throw new InternalServerErrorException('Generated CV upload failed');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Delete a file by public ID (used when a user replaces or removes a file)
  // ─────────────────────────────────────────────────────────────────────────────

  async deleteFile(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw' = 'image',
  ): Promise<void> {
    try {
      await this.cloudinaryClient.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      this.logger.log(`Deleted Cloudinary asset: ${publicId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete Cloudinary asset: ${publicId}`,
        error,
      );
      throw new InternalServerErrorException('File deletion failed');
    }
  }
}
