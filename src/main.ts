import './instrument';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { httpRequestLogger } from './common/middleware/http-request-logger.middleware';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'JWT_ACCESS_EXPIRES_SEC',
  'JWT_REFRESH_EXPIRES_SEC',
  'OTP_EXPIRES_MINUTES',
] as const;

function ensureMandatoryEnvVars(): void {
  for (const key of REQUIRED_ENV_VARS) {
    const v = process.env[key];
    if (v === undefined || String(v).trim() === '') {
      throw new Error(
        `Missing required environment variable: ${key}. See .env.example (Joballa Auth Spec).`,
      );
    }
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('Initializing Joballa backend...');
  logger.log('Loading environment configuration...');

  ensureMandatoryEnvVars();

  const nestLogLevels =
    process.env.NEST_DEBUG_LOG === '1' || process.env.NEST_DEBUG_LOG === 'true'
      ? (['error', 'warn', 'log', 'debug', 'verbose'] as const)
      : undefined;

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    nestLogLevels ? { logger: [...nestLogLevels] } : undefined,
  );

  // Global exception filter should be registered before any other middleware or routes to ensure it catches all exceptions
  app.useGlobalFilters(new GlobalExceptionFilter());

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(httpRequestLogger);
  expressApp.use(cookieParser());

  const rawTrust = process.env.TRUST_PROXY;
  if (rawTrust === 'false' || rawTrust === '0') {
    expressApp.set('trust proxy', false);
  } else if (rawTrust === undefined || rawTrust === '') {
    expressApp.set('trust proxy', 1);
  } else {
    expressApp.set('trust proxy', Number.parseInt(rawTrust, 10) || 1);
  }

  const port = Number(process.env.PORT ?? 5000);
  const corsAllowAll =
    process.env.CORS_ALLOW_ALL === 'true' ||
    process.env.CORS_ALLOW_ALL === '1' ||
    (process.env.CORS_ORIGINS ?? '').trim() === '*';
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin && origin !== '*');

  /** Reflect request Origin (required for credentials; cannot use literal *). */
  const reflectRequestOrigin = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean | string) => void,
  ) => {
    callback(null, origin ?? true);
  };

  const corsOrigin: boolean | string[] | typeof reflectRequestOrigin =
    corsAllowAll || corsOrigins.length === 0
      ? reflectRequestOrigin
      : corsOrigins;

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  logger.log(`Resolved application port: ${port}`);
  logger.log(
    `Configured CORS: ${
      corsAllowAll || corsOrigins.length === 0
        ? 'all origins (reflect request Origin)'
        : corsOrigins.join(', ')
    }`,
  );
  logger.log('Starting HTTP server...');
  await app.listen(port);
  logger.log(`Joballa backend is running on port ${port}`);
  logger.log(`Root terminal available at http://localhost:${port}/`);
}
void bootstrap();
