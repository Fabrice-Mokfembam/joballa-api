import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

interface FileValidationOptions {
  allowedMimeTypes: readonly string[];
  maxSizeBytes: number;
}

/**
 * FileTypeValidationPipe
 *
 * Validates a Multer file before it reaches the service.
 * Rejects the request early with a 400 if:
 *   - The MIME type is not in the allowed list
 *   - The file exceeds the maximum allowed size
 *
 * Usage in a controller:
 *   @UploadedFile(new FileTypeValidationPipe({ allowedMimeTypes: ALLOWED_MIME_TYPES.IMAGES, maxSizeBytes: MAX_FILE_SIZES.PROFILE_PHOTO }))
 *   file: Express.Multer.File
 */
@Injectable()
export class FileTypeValidationPipe implements PipeTransform {
  constructor(private readonly options: FileValidationOptions) {}

  transform(file: Express.Multer.File, _metadata: ArgumentMetadata) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!this.options.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed types: ${this.options.allowedMimeTypes.join(', ')}`,
      );
    }

    if (file.size > this.options.maxSizeBytes) {
      const maxMB = (this.options.maxSizeBytes / (1024 * 1024)).toFixed(0);
      throw new BadRequestException(
        `File too large. Maximum allowed size is ${maxMB} MB`,
      );
    }

    return file;
  }
}
