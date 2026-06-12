import { Injectable } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ALL_ADMIN_PERMISSIONS,
  defaultPermissionsForRole,
  type AdminPermissionKey,
} from './admin.constants';
import type { AdminContext, AdminSession } from './admin.types';
import { adminRoleToApi, adminForbidden } from './admin-api-format';

@Injectable()
export class AdminContextService {
  constructor(private readonly prisma: PrismaService) {}

  async loadContext(adminId: string): Promise<AdminContext | null> {
    const admin = await this.prisma.adminAccount.findUnique({
      where: { id: adminId },
      include: {
        permissions: true,
        departmentLinks: {
          include: { department: { select: { id: true, name: true } } },
        },
      },
    });
    if (!admin) return null;

    const explicit = admin.permissions.map(
      (p) => p.permission as AdminPermissionKey,
    );
    const permissions =
      admin.role === AdminRole.SUPER_ADMIN
        ? [...ALL_ADMIN_PERMISSIONS]
        : explicit.length
          ? explicit
          : defaultPermissionsForRole(admin.role);

    return {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      isActive: admin.isActive,
      permissions,
      departmentIds: admin.departmentLinks.map((d) => d.departmentId),
      isSuperAdmin: admin.role === AdminRole.SUPER_ADMIN,
      isAdminManager: admin.role === AdminRole.ADMIN_MANAGER,
    };
  }

  sessionFromContext(
    ctx: AdminContext,
    departments: Array<{ id: string; name: string }>,
    lastLoginAt: Date | null,
  ): AdminSession {
    return {
      id: ctx.id,
      name: ctx.fullName,
      email: ctx.email,
      role: adminRoleToApi(ctx.role),
      isActive: ctx.isActive,
      permissions: ctx.permissions,
      departments,
      lastLoginAt: lastLoginAt?.toISOString() ?? null,
    };
  }

  hasPermission(ctx: AdminContext, permission: AdminPermissionKey): boolean {
    if (ctx.isSuperAdmin) return true;
    return ctx.permissions.includes(permission);
  }

  requirePermission(ctx: AdminContext, permission: AdminPermissionKey): void {
    if (!this.hasPermission(ctx, permission)) {
      adminForbidden();
    }
  }

  departmentScopeWhere(ctx: AdminContext, departmentField = 'departmentId') {
    if (
      ctx.isSuperAdmin ||
      ctx.isAdminManager ||
      ctx.departmentIds.length === 0
    ) {
      return {};
    }
    return { [departmentField]: { in: ctx.departmentIds } };
  }
}
