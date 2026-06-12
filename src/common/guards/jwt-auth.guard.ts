import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus } from '@prisma/client';
import { throwAccountSuspended } from '../errors/account-suspended.error';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtAccessPayload } from '../../modules/auth/types/jwt-access-payload.interface';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { mapUserToLocalAuthUser } from '../types/auth-context.type';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header?.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Authorization header missing.');
    }

    const token = header.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Bearer token missing.');
    }

    let payload: JwtAccessPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Access token payload is invalid.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        workerProfile: { select: { id: true } },
        employerProfile: { select: { id: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists.');
    }

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throwAccountSuspended();
    }
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('This account is not active.');
    }

    request.user = mapUserToLocalAuthUser(user);
    return true;
  }
}
