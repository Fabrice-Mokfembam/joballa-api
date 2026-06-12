export const FILES_MODULE_NAME = 'files';

/**
 * Cloudinary folder paths — keeps all joballa assets organised in the
 * media library. Each upload type maps to a dedicated folder.
 */
export const CLOUDINARY_FOLDERS = {
  PROFILE_PHOTOS: 'joballa/profile-photos',
  VERIFICATION_DOCS: 'joballa/verification-docs',
  JOB_ATTACHMENTS: 'joballa/job-attachments',
  EMPLOYER_LOGOS: 'joballa/employer-logos',
  PORTFOLIO_DOCS: 'joballa/portfolio-docs',
  RESUME_UPLOADS: 'joballa/resume-uploads',
  GENERATED_CV_EXPORTS: 'joballa/generated-cv-exports',
} as const;

export const MAX_GENERATED_CV_BYTES = 5 * 1024 * 1024;

/**
 * Allowed MIME types per upload category.
 * Validated in the FileTypeValidationPipe before the file reaches the service.
 */
export const ALLOWED_MIME_TYPES = {
  IMAGES: ['image/jpeg', 'image/png', 'image/webp'],
  DOCUMENTS: ['application/pdf'],
  IMAGES_AND_DOCS: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
} as const;

/** Max file sizes in bytes */
export const MAX_FILE_SIZES = {
  PROFILE_PHOTO: 5 * 1024 * 1024, // 5 MB
  VERIFICATION_DOC: 10 * 1024 * 1024, // 10 MB
  JOB_ATTACHMENT: 10 * 1024 * 1024, // 10 MB
  EMPLOYER_LOGO: 2 * 1024 * 1024, // 2 MB
  RESUME: 5 * 1024 * 1024, // 5 MB
} as const;
