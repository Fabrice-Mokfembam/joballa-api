import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { accessTokenExpiresSeconds } from '../../auth/utils/jwt-ttl';
import {
  canonicalIdentifierFromUnknown,
  looksLikeEmail,
} from '../../auth/utils/identifier.util';
import type { LoginDto } from '../../auth/dto/login.dto';
import {
  ADMIN_JWT_TYP,
  ADMIN_REFRESH_COOKIE,
  ALL_ADMIN_PERMISSIONS,
  defaultPermissionsForRole,
} from './admin.constants';
import {
  adminAccountSuspended,
  adminOk,
  adminUnauthorized,
} from './admin-api-format';
import { AdminContextService } from './admin-context.service';
import type { AdminContext, AdminJwtPayload } from './admin.types';
import { AdminRole } from '@prisma/client';

const REFRESH_BCRYPT_ROUNDS = 12;

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly adminContext: AdminContextService,
  ) {}

  async login(dto: LoginDto, res: Response) {
    const canonical = canonicalIdentifierFromUnknown(dto.identifier);
    const isEmail = looksLikeEmail(canonical);
    const admin = await this.prisma.adminAccount.findFirst({
      where: isEmail ? { email: canonical } : { email: canonical },
      include: {
        permissions: true,
        departmentLinks: {
          include: { department: { select: { id: true, name: true } } },
        },
      },
    });
    if (!admin?.passwordHash) adminUnauthorized('Invalid credentials.');
    const ok = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!ok) adminUnauthorized('Invalid credentials.');
    if (!admin.isActive) adminAccountSuspended();

    await this.prisma.adminAccount.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    return this.finalizeSession(admin, res);
  }

  async refresh(req: Request, res: Response) {
    const raw =
      (req.body?.refreshToken as string | undefined)?.trim() ||
      (req.cookies?.[ADMIN_REFRESH_COOKIE] as string | undefined)?.trim();
    if (!raw) adminUnauthorized('No refresh token provided.');

    const digest = createHash('sha256').update(raw).digest('hex');
    const row = await this.prisma.adminRefreshToken.findUnique({
      where: { lookupDigest: digest },
      include: {
        admin: {
          include: {
            permissions: true,
            departmentLinks: {
              include: { department: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    if (!row || row.expiresAt <= new Date()) {
      if (row)
        await this.prisma.adminRefreshToken.delete({ where: { id: row.id } });
      adminUnauthorized('Invalid refresh token.');
    }
    if (!row.admin.isActive) {
      await this.prisma.adminRefreshToken.delete({ where: { id: row.id } });
      adminAccountSuspended();
    }
    const match = await bcrypt.compare(raw, row.tokenHash);
    if (!match) adminUnauthorized('Invalid refresh token.');
    await this.prisma.adminRefreshToken.delete({ where: { id: row.id } });
    return this.finalizeSession(row.admin, res);
  }

  async logout(req: Request, res: Response) {
    const raw = (
      req.cookies?.[ADMIN_REFRESH_COOKIE] as string | undefined
    )?.trim();
    if (raw) {
      const digest = createHash('sha256').update(raw).digest('hex');
      await this.prisma.adminRefreshToken.deleteMany({
        where: { lookupDigest: digest },
      });
    }
    res.clearCookie(ADMIN_REFRESH_COOKIE, {
      path: this.config.get('COOKIE_PATH') || '/',
    });
    return adminOk({ message: 'Logged out' });
  }

  private async finalizeSession(
    admin: {
      id: string;
      email: string;
      fullName: string;
      role: AdminRole;
      isActive: boolean;
      lastLoginAt: Date | null;
      permissions: { permission: string }[];
      departmentLinks: { department: { id: string; name: string } }[];
    },
    res: Response,
  ) {
    await this.prisma.adminRefreshToken.deleteMany({
      where: { adminId: admin.id, expiresAt: { lt: new Date() } },
    });

    const plain = randomBytes(32).toString('hex');
    const digest = createHash('sha256').update(plain).digest('hex');
    const ttlMs = this.refreshTtlMs();
    await this.prisma.adminRefreshToken.create({
      data: {
        adminId: admin.id,
        lookupDigest: digest,
        tokenHash: await bcrypt.hash(plain, REFRESH_BCRYPT_ROUNDS),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });

    res.cookie(ADMIN_REFRESH_COOKIE, plain, {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === 'production' ||
        this.config.get('COOKIE_SECURE') === 'true',
      sameSite: (this.config.get('COOKIE_SAME_SITE') as 'lax') || 'lax',
      path: this.config.get('COOKIE_PATH') || '/',
      maxAge: ttlMs,
    });

    const permissions =
      admin.role === AdminRole.SUPER_ADMIN
        ? ALL_ADMIN_PERMISSIONS
        : admin.permissions.length
          ? admin.permissions.map((p) => p.permission)
          : defaultPermissionsForRole(admin.role);
    const departmentIds = admin.departmentLinks.map((d) => d.department.id);

    const payload: AdminJwtPayload = {
      sub: admin.id,
      role: admin.role,
      permissions,
      department_ids: departmentIds,
      typ: ADMIN_JWT_TYP,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: accessTokenExpiresSeconds(this.config),
    });

    const ctx: AdminContext = {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      isActive: admin.isActive,
      permissions: permissions as never,
      departmentIds,
      isSuperAdmin: admin.role === AdminRole.SUPER_ADMIN,
      isAdminManager: admin.role === AdminRole.ADMIN_MANAGER,
    };

    return adminOk({
      accessToken,
      refreshToken: plain,
      session: this.adminContext.sessionFromContext(
        ctx,
        admin.departmentLinks.map((d) => d.department),
        admin.lastLoginAt,
      ),
    });
  }

  private refreshTtlMs(): number {
    const sec = Number.parseInt(
      this.config.get('JWT_REFRESH_EXPIRES_SEC') ?? '604800',
      10,
    );
    return (Number.isFinite(sec) ? sec : 604800) * 1000;
  }
}
