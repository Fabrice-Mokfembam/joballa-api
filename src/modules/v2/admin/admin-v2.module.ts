import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminContextService } from './admin-context.service';
import { AdminV2Controller } from './admin-v2.controller';
import { AdminV2Service } from './admin-v2.service';
import { AdminJwtGuard } from './guards/admin-jwt.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminAuthController, AdminV2Controller],
  providers: [
    AdminJwtGuard,
    AdminContextService,
    AdminAuditService,
    AdminAuthService,
    AdminV2Service,
  ],
})
export class AdminV2Module {}
