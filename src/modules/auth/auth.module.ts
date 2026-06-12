import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthController } from './controllers/auth.controller';
import { OtpCodesRepository } from './repositories/otp-codes.repository';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { AuthMessagingService } from './services/auth-messaging.service';
import { AuthService } from './services/auth.service';
import { GoogleTokenService } from './services/google-token.service';
import { OtpResendThrottleService } from './services/otp-resend-throttle.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('AuthModule');
        const fromEnv = config.get<string>('JWT_SECRET')?.trim();
        const secret =
          fromEnv ??
          (process.env.NODE_ENV === 'production'
            ? ''
            : 'dev-only-joballa-jwt-secret-not-for-production');

        if (!secret) {
          throw new Error('JWT_SECRET is required when NODE_ENV=production.');
        }

        if (!fromEnv) {
          logger.warn('JWT_SECRET is unset; using a development default.');
        }

        return { secret };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleTokenService,
    AuthMessagingService,
    OtpResendThrottleService,
    OtpCodesRepository,
    RefreshTokensRepository,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [JwtModule, AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
