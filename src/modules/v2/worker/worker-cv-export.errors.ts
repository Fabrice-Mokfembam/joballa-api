import { HttpException, HttpStatus } from '@nestjs/common';

export function profileInsufficientForCv() {
  return new HttpException(
    {
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      code: 'PROFILE_INSUFFICIENT_FOR_CV',
      message:
        'Complete your name and professional summary before exporting your CV.',
    },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

export function generatedCvNotFound() {
  return new HttpException(
    {
      statusCode: HttpStatus.NOT_FOUND,
      code: 'GENERATED_CV_NOT_FOUND',
      message: 'Generate your CV before downloading it.',
    },
    HttpStatus.NOT_FOUND,
  );
}

export function cvGenerationFailed() {
  return new HttpException(
    {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'CV_GENERATION_FAILED',
      message: 'We could not generate your CV. Please try again.',
    },
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
