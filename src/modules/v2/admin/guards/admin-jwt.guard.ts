import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ADMIN_JWT_TYP } from '../admin.constants';
import { adminAccountSuspended, adminUnauthorized } from '../admin-api-format';
import type { AdminJwtPayload } from '../admin.types';
import { AdminContextService } from '../admin-context.service';
import { ADMIN_PERMISSION_KEY } from '../decorators/require-permission.decorator';

export type AdminRequest = {
  adminContext?: Awaited<ReturnType<AdminContextService['loadContext']>>;
  headers: { authorization?: string };
};

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly adminContext: AdminContextService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const header = request.headers.authorization;
    if (!header?.toLowerCase().startsWith('bearer ')) {
      adminUnauthorized('Authorization header missing.');
    }
    const token = header.slice(7).trim();
    if (!token) adminUnauthorized('Bearer token missing.');

    let payload: AdminJwtPayload | undefined;
    try {
      payload = await this.jwtService.verifyAsync<AdminJwtPayload>(token);
    } catch {
      adminUnauthorized();
    }
    if (!payload || payload.typ !== ADMIN_JWT_TYP || !payload.sub) {
      adminUnauthorized('Access token payload is invalid.');
    }

    const ctx = await this.adminContext.loadContext(payload.sub);
    if (!ctx) adminUnauthorized('Admin account is not active.');
    if (!ctx.isActive) adminAccountSuspended();

    request.adminContext = ctx;

    const permission = this.reflector.getAllAndOverride<string | undefined>(
      ADMIN_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (permission) {
      this.adminContext.requirePermission(ctx, permission as never);
    }

    return true;
  }
}
