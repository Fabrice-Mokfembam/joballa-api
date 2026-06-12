import { Injectable } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AdminContext } from './admin.types';
import { adminRoleToApi, parseListQuery } from './admin-api-format';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  clientIp(req?: Request): string | undefined {
    if (!req) return undefined;
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
    return req.ip;
  }

  async log(
    ctx: AdminContext,
    module: string,
    action: string,
    details: string,
    req?: Request,
  ) {
    await this.prisma.adminAuditLog.create({
      data: {
        adminId: ctx.id,
        module,
        action,
        details,
        ipAddress: this.clientIp(req),
      },
    });
  }

  logsWhere(ctx: AdminContext) {
    if (ctx.isSuperAdmin) return {};
    if (ctx.isAdminManager) {
      return {
        admin: { role: { not: AdminRole.SUPER_ADMIN } },
      };
    }
    return { adminId: ctx.id };
  }

  async list(ctx: AdminContext, query: Record<string, unknown>) {
    const q = parseListQuery(query);
    const where: Record<string, unknown> = { ...this.logsWhere(ctx) };

    if (q.search) {
      where.OR = [
        { details: { contains: q.search, mode: 'insensitive' } },
        { action: { contains: q.search, mode: 'insensitive' } },
        { module: { contains: q.search, mode: 'insensitive' } },
        { admin: { fullName: { contains: q.search, mode: 'insensitive' } } },
        { admin: { email: { contains: q.search, mode: 'insensitive' } } },
      ];
    }
    if (query.module) where.module = String(query.module);
    if (query.action) where.action = String(query.action);
    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: new Date(String(query.startDate)) } : {}),
        ...(query.endDate ? { lte: new Date(String(query.endDate)) } : {}),
      };
    }
    if (query.adminId) {
      if (ctx.isSuperAdmin || ctx.isAdminManager) {
        where.adminId = String(query.adminId);
      }
    }

    const orderBy = { [q.sort === 'name' ? 'createdAt' : q.sort]: q.order };
    const [rows, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        include: {
          admin: { select: { fullName: true, email: true, role: true } },
        },
        orderBy,
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return rows.map((row) => ({
      id: row.id,
      adminId: row.adminId,
      adminName: row.admin.fullName,
      adminEmail: row.admin.email,
      adminRole: adminRoleToApi(row.admin.role),
      action: row.action,
      module: row.module,
      details: row.details,
      ipAddress: row.ipAddress ?? '',
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
