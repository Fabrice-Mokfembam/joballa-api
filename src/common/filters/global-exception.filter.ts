import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';
import { Prisma } from '@prisma/client'; // Import Prisma types directly

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. Report to Sentry
    Sentry.captureException(exception);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';
    let code: string | undefined;
    let exceptionBody: unknown;

    // 2. Handle NestJS HTTP Exceptions (404, 400, etc.)
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      exceptionBody = exception.getResponse();
      const res = exceptionBody;

      // If it's an object, check for the 'message' property safely
      if (typeof res === 'object' && res !== null) {
        const resBody = res as {
          message?: string | string[];
          code?: string;
          statusCode?: number;
        };
        message = resBody.message || exception.message;
        code = resBody.code;
        if (typeof resBody.statusCode === 'number') {
          status = resBody.statusCode;
        }
      } else {
        message = String(res);
      }

      error = exception.constructor.name;
    }
    // 3. Handle Prisma Errors (Constraint violations)
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': // Unique constraint
          status = HttpStatus.CONFLICT;
          message = 'A record with this value already exists';
          error = 'ConflictError';
          break;
        case 'P2025': // Not found
          status = HttpStatus.NOT_FOUND;
          message = 'The requested record was not found';
          error = 'NotFoundError';
          break;
        default:
          this.logger.error(
            `Prisma Error ${exception.code}: ${exception.message}`,
          );
          break;
      }
    }
    // 4. Handle everything else (Code crashes, Syntax errors)
    else {
      this.logger.error(
        'Unhandled Exception',
        exception instanceof Error ? exception.stack : exception,
      );
    }

    // 5. Send the standardized response
    if (
      exception instanceof HttpException &&
      typeof exceptionBody === 'object' &&
      exceptionBody !== null &&
      'success' in exceptionBody &&
      (exceptionBody as { success?: boolean }).success === false &&
      'error' in exceptionBody
    ) {
      response.status(status).json(exceptionBody);
      return;
    }

    response.status(status).json({
      statusCode: status,
      ...(code ? { code } : {}),
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
