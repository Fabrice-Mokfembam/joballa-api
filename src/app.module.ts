import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';
import { AuthModule } from './modules/auth/auth.module';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { EmployerV2Module } from './modules/v2/employer/employer-v2.module';
import { WorkerV2Module } from './modules/v2/worker/worker-v2.module';
import { AdminV2Module } from './modules/v2/admin/admin-v2.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60_000,
          limit: 10_000,
        },
      ],
      errorMessage: 'Too many requests. Please try again later.',
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    FilesModule,
    WorkerV2Module,
    EmployerV2Module,
    AdminV2Module,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
