import { Injectable } from '@nestjs/common';
import {
  AccountStatus,
  AdminRole,
  ApplicationSource,
  ApplicationStatus,
  DepartmentCategory,
  DisputeStatus,
  JobStatus,
  PreferredLanguage,
  Role,
  SubmissionTargetType,
  VerificationStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ADMIN_PERM,
  defaultPermissionsForRole,
  DEFAULT_ADMIN_PASSWORD,
} from './admin.constants';
import {
  adminBadRequest,
  adminConflict,
  adminForbidden,
  adminNotFound,
  adminOk,
  adminPaged,
  jobStatusFromAdminApi,
  parseAdminRole,
  parseDashboardRange,
  parseDisputeDecision,
  parseDisputePriority,
  parseDisputeStatus,
  parseEmploymentType,
  parseExperienceLevel,
  parseListQuery,
  parseWorkMode,
} from './admin-api-format';
import { AdminAuditService } from './admin-audit.service';
import { AdminContextService } from './admin-context.service';
import type { AdminContext } from './admin.types';
import {
  isReservedOtherDepartmentName,
  mapAdminRow,
  mapDepartmentRow,
  mapDisputeRow,
  mapDocumentRow,
  mapJobRow,
  mapKycRow,
  mapPaymentRecord,
  mapPlatformUser,
  mapSessionDepartments,
  profileScopeWhere,
  slugify,
} from './admin-mappers';

@Injectable()
export class AdminV2Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminContext: AdminContextService,
    private readonly audit: AdminAuditService,
  ) {}

  private async sessionPayload(ctx: AdminContext) {
    const admin = await this.prisma.adminAccount.findUnique({
      where: { id: ctx.id },
      include: {
        departmentLinks: {
          include: { department: { select: { id: true, name: true } } },
        },
      },
    });
    if (!admin) adminNotFound('Admin not found.');
    return this.adminContext.sessionFromContext(
      ctx,
      mapSessionDepartments(admin.departmentLinks),
      admin.lastLoginAt,
    );
  }

  async getDashboard(ctx: AdminContext) {
    const session = await this.sessionPayload(ctx);
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const adminCreatedWhere = { createdByAdminId: { not: null } };

    const [
      totalJobs,
      pendingJobs,
      approvedJobs,
      rejectedJobs,
      jobsThisMonth,
      workers,
      employers,
      verifiedProfiles,
      unverifiedProfiles,
      totalUsers,
      activeUsers,
      pendingKyc,
      verifiedKyc,
      rejectedKyc,
      pendingDocuments,
      approvedDocuments,
      rejectedDocuments,
      totalDisputes,
      openDisputes,
      resolvedDisputes,
      closedDisputes,
      paymentAgg,
      totalDepartments,
      totalAdmins,
      activeAdmins,
      pendingInvitations,
      inactiveAdmins,
    ] = await Promise.all([
      this.prisma.job.count(),
      this.prisma.job.count({ where: { status: JobStatus.UNDER_REVIEW } }),
      this.prisma.job.count({ where: { status: JobStatus.ACTIVE } }),
      this.prisma.job.count({ where: { status: JobStatus.REJECTED } }),
      this.prisma.job.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.user.count({
        where: { ...adminCreatedWhere, role: Role.WORKER },
      }),
      this.prisma.user.count({
        where: { ...adminCreatedWhere, role: Role.EMPLOYER },
      }),
      this.prisma.user.count({
        where: {
          ...adminCreatedWhere,
          OR: [
            {
              workerProfile: {
                verificationStatus: VerificationStatus.VERIFIED,
              },
            },
            {
              employerProfile: {
                verificationStatus: VerificationStatus.VERIFIED,
              },
            },
          ],
        },
      }),
      this.prisma.user.count({
        where: {
          ...adminCreatedWhere,
          OR: [
            {
              workerProfile: {
                verificationStatus: { not: VerificationStatus.VERIFIED },
              },
            },
            {
              employerProfile: {
                verificationStatus: { not: VerificationStatus.VERIFIED },
              },
            },
          ],
        },
      }),
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { accountStatus: AccountStatus.ACTIVE },
      }),
      this.prisma.kycSubmission.count({
        where: {
          status: {
            in: [VerificationStatus.PENDING, VerificationStatus.UNDER_REVIEW],
          },
        },
      }),
      this.prisma.kycSubmission.count({
        where: { status: VerificationStatus.VERIFIED },
      }),
      this.prisma.kycSubmission.count({
        where: { status: VerificationStatus.REJECTED },
      }),
      this.prisma.employerDocument.count({
        where: {
          verificationStatus: {
            in: [
              VerificationStatus.PENDING,
              VerificationStatus.UNDER_REVIEW,
              VerificationStatus.NOT_SUBMITTED,
            ],
          },
        },
      }),
      this.prisma.employerDocument.count({
        where: { verificationStatus: VerificationStatus.VERIFIED },
      }),
      this.prisma.employerDocument.count({
        where: { verificationStatus: VerificationStatus.REJECTED },
      }),
      this.prisma.dispute.count(),
      this.prisma.dispute.count({ where: { status: DisputeStatus.OPEN } }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.RESOLVED } }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.CLOSED } }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { status: 'COMPLETED' },
      }),
      this.prisma.department.count(),
      this.prisma.adminAccount.count(),
      this.prisma.adminAccount.count({
        where: { isActive: true, invitePending: false },
      }),
      this.prisma.adminAccount.count({ where: { invitePending: true } }),
      this.prisma.adminAccount.count({ where: { isActive: false } }),
    ]);

    return adminOk({
      session,
      jobs: {
        totalJobs,
        pendingJobs,
        approvedJobs,
        rejectedJobs,
        jobsThisMonth,
      },
      profiles: {
        totalProfiles: workers + employers,
        workers,
        employers,
        verifiedProfiles,
        unverifiedProfiles,
      },
      users: { totalUsers, activeUsers },
      kyc: { pendingKyc, verifiedKyc, rejectedKyc },
      documents: { pendingDocuments, approvedDocuments, rejectedDocuments },
      disputes: {
        totalDisputes,
        openDisputes,
        resolvedDisputes,
        closedDisputes,
      },
      finance: {
        totalTransactions: paymentAgg._count.id,
        totalAmountIn: Number(paymentAgg._sum.amount ?? 0),
        totalAmountOut: 0,
        netBalance: Number(paymentAgg._sum.amount ?? 0),
      },
      departments: { totalDepartments },
      admins: {
        totalAdmins,
        activeAdmins,
        pendingInvitations,
        inactiveAdmins,
      },
    });
  }

  async getDashboardAnalytics(
    ctx: AdminContext,
    query: Record<string, unknown>,
  ) {
    const { start, end } = parseDashboardRange(query);
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const prevMonthStart = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() - 1,
      1,
    );
    const prevMonthEnd = new Date(monthStart.getTime() - 1);

    const [
      totalJobs,
      jobsCreatedThisMonth,
      totalApplications,
      applicationsThisMonth,
      activeUsers,
      activeUsersThisMonth,
      kycSubmissions,
      kycSubmissionsPrevMonth,
      verifiedUsers,
      verifiedUsersThisMonth,
      jobStatusGroups,
      docStatusGroups,
      kycStatusGroups,
      applicationsInRange,
      departments,
      recentLogs,
    ] = await Promise.all([
      this.prisma.job.count(),
      this.prisma.job.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.application.count(),
      this.prisma.application.count({
        where: { createdAt: { gte: monthStart } },
      }),
      this.prisma.user.count({
        where: { accountStatus: AccountStatus.ACTIVE },
      }),
      this.prisma.user.count({
        where: {
          accountStatus: AccountStatus.ACTIVE,
          createdAt: { gte: monthStart },
        },
      }),
      this.prisma.kycSubmission.count({
        where: { createdAt: { gte: monthStart } },
      }),
      this.prisma.kycSubmission.count({
        where: {
          createdAt: { gte: prevMonthStart, lte: prevMonthEnd },
        },
      }),
      this.prisma.user.count({
        where: {
          OR: [
            {
              workerProfile: {
                verificationStatus: VerificationStatus.VERIFIED,
              },
            },
            {
              employerProfile: {
                verificationStatus: VerificationStatus.VERIFIED,
              },
            },
          ],
        },
      }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: monthStart },
          OR: [
            {
              workerProfile: {
                verificationStatus: VerificationStatus.VERIFIED,
              },
            },
            {
              employerProfile: {
                verificationStatus: VerificationStatus.VERIFIED,
              },
            },
          ],
        },
      }),
      this.prisma.job.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.employerDocument.groupBy({
        by: ['verificationStatus'],
        _count: { id: true },
      }),
      this.prisma.kycSubmission.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.application.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { createdAt: true, source: true },
      }),
      this.prisma.department.findMany({
        select: { id: true, name: true },
      }),
      this.prisma.adminAuditLog.findMany({
        where: this.audit.logsWhere(ctx),
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ]);

    const jobStatusMap = Object.fromEntries(
      jobStatusGroups.map((g) => [g.status, g._count.id]),
    );
    const docStatusMap = Object.fromEntries(
      docStatusGroups.map((g) => [g.verificationStatus, g._count.id]),
    );
    const kycStatusMap = Object.fromEntries(
      kycStatusGroups.map((g) => [g.status, g._count.id]),
    );

    const applicationsByDay = new Map<string, number>();
    for (const app of applicationsInRange) {
      const key = app.createdAt.toISOString().slice(0, 10);
      applicationsByDay.set(key, (applicationsByDay.get(key) ?? 0) + 1);
    }
    const applicationsOverTime = [...applicationsByDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, applications]) => ({ date, applications }));

    const topDepartments = (
      await Promise.all(
        departments.map(async (dept) => {
          const [jobs, applications, hires] = await Promise.all([
            this.prisma.job.count({ where: { departmentId: dept.id } }),
            this.prisma.application.count({
              where: { job: { departmentId: dept.id } },
            }),
            this.prisma.application.count({
              where: {
                job: { departmentId: dept.id },
                status: ApplicationStatus.HIRED,
              },
            }),
          ]);
          return {
            departmentId: dept.id,
            departmentName: dept.name,
            jobs,
            applications,
            hires,
            conversionRate:
              applications > 0
                ? Math.round((hires / applications) * 10000) / 100
                : 0,
          };
        }),
      )
    )
      .sort((a, b) => b.applications - a.applications)
      .slice(0, 10);

    const kycSubmissionPercentChange =
      kycSubmissionsPrevMonth === 0
        ? kycSubmissions > 0
          ? 100
          : 0
        : Math.round(
            ((kycSubmissions - kycSubmissionsPrevMonth) /
              kycSubmissionsPrevMonth) *
              10000,
          ) / 100;

    return adminOk({
      range: { start: start.toISOString(), end: end.toISOString() },
      kpis: {
        totalJobs,
        jobsCreatedThisMonth,
        totalApplications,
        applicationsThisMonth,
        activeUsers,
        activeUsersThisMonth,
        kycSubmissions,
        kycSubmissionPercentChange,
        verifiedUsers,
        verifiedUsersThisMonth,
      },
      applicationsOverTime,
      jobsByStatus: {
        active: jobStatusMap[JobStatus.ACTIVE] ?? 0,
        draft: jobStatusMap[JobStatus.DRAFT] ?? 0,
        paused: jobStatusMap[JobStatus.PAUSED] ?? 0,
        closed: jobStatusMap[JobStatus.CLOSED] ?? 0,
      },
      documentsByStatus: {
        approved: docStatusMap[VerificationStatus.VERIFIED] ?? 0,
        pending:
          (docStatusMap[VerificationStatus.PENDING] ?? 0) +
          (docStatusMap[VerificationStatus.UNDER_REVIEW] ?? 0) +
          (docStatusMap[VerificationStatus.NOT_SUBMITTED] ?? 0),
        rejected: docStatusMap[VerificationStatus.REJECTED] ?? 0,
      },
      kycFunnel: {
        submitted:
          (kycStatusMap[VerificationStatus.PENDING] ?? 0) +
          (kycStatusMap[VerificationStatus.UNDER_REVIEW] ?? 0) +
          (kycStatusMap[VerificationStatus.VERIFIED] ?? 0) +
          (kycStatusMap[VerificationStatus.REJECTED] ?? 0),
        underReview: kycStatusMap[VerificationStatus.UNDER_REVIEW] ?? 0,
        verified: kycStatusMap[VerificationStatus.VERIFIED] ?? 0,
        rejected: kycStatusMap[VerificationStatus.REJECTED] ?? 0,
      },
      applicationsBySource: [
        {
          source: 'web',
          applications: applicationsInRange.filter(
            (app) => app.source !== ApplicationSource.MOBILE_APP,
          ).length,
        },
        {
          source: 'mobile_app',
          applications: applicationsInRange.filter(
            (app) => app.source === ApplicationSource.MOBILE_APP,
          ).length,
        },
      ],
      topDepartments,
      recentActivity: recentLogs.map((log) => ({
        id: log.id,
        type: `${log.module}.${log.action}`,
        description: log.details,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  }

  async exportDashboardReport(
    ctx: AdminContext,
    query: Record<string, unknown>,
  ): Promise<string> {
    this.adminContext.requirePermission(
      ctx,
      ADMIN_PERM.VIEW_PLATFORM_ANALYTICS,
    );
    const format = String(query.format || 'csv').toLowerCase();
    if (format !== 'csv') {
      adminBadRequest('Only format=csv is supported.');
    }
    const analytics = (await this.getDashboardAnalytics(ctx, query)).data as {
      range: { start: string; end: string };
      kpis: Record<string, number>;
      jobsByStatus: Record<string, number>;
      documentsByStatus: Record<string, number>;
      kycFunnel: Record<string, number>;
    };
    const lines = [
      'Joballa Admin Dashboard Export',
      `Range,${analytics.range.start},${analytics.range.end}`,
      '',
      'KPI,Value',
      ...Object.entries(analytics.kpis).map(([k, v]) => `${k},${v}`),
      '',
      'Jobs By Status,Count',
      ...Object.entries(analytics.jobsByStatus).map(([k, v]) => `${k},${v}`),
      '',
      'Documents By Status,Count',
      ...Object.entries(analytics.documentsByStatus).map(
        ([k, v]) => `${k},${v}`,
      ),
      '',
      'KYC Funnel,Count',
      ...Object.entries(analytics.kycFunnel).map(([k, v]) => `${k},${v}`),
    ];
    return lines.join('\n');
  }

  async getMe(ctx: AdminContext) {
    return adminOk({ session: await this.sessionPayload(ctx) });
  }

  async patchMe(
    ctx: AdminContext,
    body: Record<string, unknown>,
    req: Request,
  ) {
    const data: Record<string, unknown> = {};
    if (body.name) data.fullName = String(body.name);
    if (body.newPassword) {
      if (!body.currentPassword)
        adminBadRequest('currentPassword is required to change password.');
      const admin = await this.prisma.adminAccount.findUnique({
        where: { id: ctx.id },
      });
      const ok = await bcrypt.compare(
        String(body.currentPassword),
        admin!.passwordHash,
      );
      if (!ok) adminBadRequest('Current password is incorrect.');
      if (String(body.newPassword).length < 8)
        adminBadRequest('New password must be at least 8 characters.');
      data.passwordHash = await bcrypt.hash(String(body.newPassword), 12);
    }
    if (Object.keys(data).length) {
      await this.prisma.adminAccount.update({ where: { id: ctx.id }, data });
      await this.audit.log(
        ctx,
        'admins',
        'updated',
        'Updated own admin profile',
        req,
      );
    }
    return adminOk({ session: await this.sessionPayload(ctx) });
  }

  async listLogs(ctx: AdminContext, query: Record<string, unknown>) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VIEW_PLATFORM_LOGS);
    const q = parseListQuery(query);
    const items = await this.audit.list(ctx, query);
    const total = await this.prisma.adminAuditLog.count({
      where: this.audit.logsWhere(ctx),
    });
    return adminPaged(items, q.page, q.limit, total);
  }

  // --- KYC ---
  async listKyc(ctx: AdminContext, query: Record<string, unknown>) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VERIFY_KYC);
    const q = parseListQuery(query);
    const where: Record<string, unknown> = {};
    if (query.status) {
      const s = String(query.status).toLowerCase();
      if (s === 'verified') where.status = VerificationStatus.VERIFIED;
      else if (s === 'rejected') where.status = VerificationStatus.REJECTED;
      else
        where.status = {
          in: [VerificationStatus.PENDING, VerificationStatus.UNDER_REVIEW],
        };
    }
    if (query.idType) where.kycType = String(query.idType).toUpperCase();
    if (q.search) {
      where.worker = {
        OR: [
          { email: { contains: q.search, mode: 'insensitive' } },
          { phone: { contains: q.search } },
          {
            workerProfile: {
              fullName: { contains: q.search, mode: 'insensitive' },
            },
          },
        ],
      };
    }
    const [rows, total] = await Promise.all([
      this.prisma.kycSubmission.findMany({
        where,
        include: { worker: { include: { workerProfile: true } } },
        orderBy: { [q.sort === 'workerName' ? 'createdAt' : q.sort]: q.order },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.kycSubmission.count({ where }),
    ]);
    return adminPaged(rows.map(mapKycRow), q.page, q.limit, total);
  }

  async getKyc(ctx: AdminContext, id: string) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VERIFY_KYC);
    const row = await this.prisma.kycSubmission.findUnique({
      where: { id },
      include: { worker: { include: { workerProfile: true } } },
    });
    if (!row) adminNotFound('KYC submission not found.');
    return adminOk(mapKycRow(row));
  }

  async approveKyc(ctx: AdminContext, id: string, req: Request) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VERIFY_KYC);
    const row = await this.prisma.kycSubmission.findUnique({
      where: { id },
      include: { worker: { include: { workerProfile: true } } },
    });
    if (!row) adminNotFound('KYC submission not found.');
    const workerName =
      row.worker.workerProfile?.fullName ?? row.worker.email ?? 'worker';
    await this.prisma.$transaction([
      this.prisma.kycSubmission.update({
        where: { id },
        data: {
          status: VerificationStatus.VERIFIED,
          verifiedAt: new Date(),
          verifiedByAdminId: ctx.id,
          rejectionReason: null,
        },
      }),
      this.prisma.workerProfile.updateMany({
        where: { userId: row.workerId },
        data: { verificationStatus: VerificationStatus.VERIFIED },
      }),
    ]);
    await this.audit.log(
      ctx,
      'kyc',
      'approved',
      `KYC approved for ${workerName}`,
      req,
    );
    return this.getKyc(ctx, id);
  }

  async rejectKyc(
    ctx: AdminContext,
    id: string,
    body: Record<string, unknown>,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VERIFY_KYC);
    if (!body.reason) adminBadRequest('reason is required.');
    const row = await this.prisma.kycSubmission.findUnique({
      where: { id },
      include: { worker: { include: { workerProfile: true } } },
    });
    if (!row) adminNotFound('KYC submission not found.');
    const workerName =
      row.worker.workerProfile?.fullName ?? row.worker.email ?? 'worker';
    await this.prisma.$transaction([
      this.prisma.kycSubmission.update({
        where: { id },
        data: {
          status: VerificationStatus.REJECTED,
          verifiedAt: new Date(),
          verifiedByAdminId: ctx.id,
          rejectionReason: String(body.reason),
        },
      }),
      this.prisma.rejectionReason.create({
        data: {
          targetType: SubmissionTargetType.KYC_DOCUMENT,
          targetId: id,
          reasonText: String(body.reason),
          rejectedByAdminId: ctx.id,
        },
      }),
    ]);
    await this.audit.log(
      ctx,
      'kyc',
      'rejected',
      `KYC rejected for ${workerName}`,
      req,
    );
    return this.getKyc(ctx, id);
  }

  async updateKycStatus(
    ctx: AdminContext,
    id: string,
    body: Record<string, unknown>,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VERIFY_KYC);
    const status = String(body.status || '').toLowerCase();
    if (!['pending', 'verified', 'rejected'].includes(status)) {
      adminBadRequest('status must be pending, verified, or rejected.');
    }
    if (status === 'verified') return this.approveKyc(ctx, id, req);
    if (status === 'rejected') {
      if (!body.reason) adminBadRequest('reason is required when rejecting.');
      return this.rejectKyc(ctx, id, body, req);
    }

    const row = await this.prisma.kycSubmission.findUnique({
      where: { id },
      include: { worker: { include: { workerProfile: true } } },
    });
    if (!row) adminNotFound('KYC submission not found.');

    await this.prisma.$transaction([
      this.prisma.kycSubmission.update({
        where: { id },
        data: {
          status: VerificationStatus.PENDING,
          verifiedAt: null,
          verifiedByAdminId: null,
          rejectionReason: null,
        },
      }),
      this.prisma.workerProfile.updateMany({
        where: { userId: row.workerId },
        data: { verificationStatus: VerificationStatus.PENDING },
      }),
    ]);

    const workerName =
      row.worker.workerProfile?.fullName ?? row.worker.email ?? 'worker';
    await this.audit.log(
      ctx,
      'kyc',
      'updated',
      `Returned ${workerName}'s KYC to pending`,
      req,
    );
    return this.getKyc(ctx, id);
  }

  private disputeDepartmentWhere(ctx: AdminContext) {
    if (
      ctx.departmentIds.length === 0 ||
      ctx.isSuperAdmin ||
      ctx.isAdminManager
    )
      return {};
    return {
      engagement: { job: { departmentId: { in: ctx.departmentIds } } },
    };
  }

  private async jobExtras(jobId: string) {
    const [rejectionReason, submissionScore] = await Promise.all([
      this.prisma.rejectionReason.findFirst({
        where: { targetType: SubmissionTargetType.JOB, targetId: jobId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.submissionScore.findFirst({
        where: { targetType: SubmissionTargetType.JOB, targetId: jobId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      rejectionReason,
      submissionScore: submissionScore
        ? {
            score: submissionScore.score,
            tier: submissionScore.tier.toLowerCase(),
            scoreBreakdown: submissionScore.scoreBreakdown,
          }
        : null,
    };
  }

  private async fetchJobs(
    ctx: AdminContext,
    query: Record<string, unknown>,
    statusFilter?: JobStatus[],
  ) {
    const q = parseListQuery(query);
    const where: Record<string, unknown> = {
      ...this.adminContext.departmentScopeWhere(ctx),
    };
    if (statusFilter) where.status = { in: statusFilter };
    else if (query.status) {
      const mapped = jobStatusFromAdminApi(query.status);
      if (mapped) where.status = mapped;
    }
    if (query.departmentId) where.departmentId = String(query.departmentId);
    if (query.employmentType) {
      const et = parseEmploymentType(query.employmentType);
      if (et) where.employmentType = et;
    }
    if (query.jobType) {
      const wm = parseWorkMode(query.jobType);
      if (wm) where.workMode = wm;
    }
    if (query.experienceLevel) {
      const el = parseExperienceLevel(query.experienceLevel);
      if (el) where.experienceLevel = el;
    }
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        {
          owner: {
            employerProfile: {
              companyName: { contains: q.search, mode: 'insensitive' },
            },
          },
        },
      ];
    }
    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        include: {
          department: true,
          owner: { include: { employerProfile: true } },
        },
        orderBy: {
          [q.sort === 'title'
            ? 'title'
            : q.sort === 'payAmount'
              ? 'payAmount'
              : 'createdAt']: q.order,
        },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.job.count({ where }),
    ]);
    const mapped = await Promise.all(
      jobs.map(async (job) => mapJobRow(job, await this.jobExtras(job.id))),
    );
    return { mapped, q, total };
  }

  async listJobs(ctx: AdminContext, query: Record<string, unknown>) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_JOBS);
    const { mapped, q, total } = await this.fetchJobs(ctx, query);
    return adminPaged(mapped, q.page, q.limit, total);
  }

  async listPendingJobs(ctx: AdminContext, query: Record<string, unknown>) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VERIFY_JOBS);
    const { mapped, q, total } = await this.fetchJobs(ctx, query, [
      JobStatus.UNDER_REVIEW,
    ]);
    return adminPaged(mapped, q.page, q.limit, total);
  }

  async listRejectedJobs(ctx: AdminContext, query: Record<string, unknown>) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_JOBS);
    const { mapped, q, total } = await this.fetchJobs(ctx, query, [
      JobStatus.REJECTED,
    ]);
    return adminPaged(mapped, q.page, q.limit, total);
  }

  async approveJob(ctx: AdminContext, jobId: string, req: Request) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VERIFY_JOBS);
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) adminNotFound('Job not found.');
    if (job.status !== JobStatus.UNDER_REVIEW)
      adminBadRequest('Job is not pending review.');
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.ACTIVE,
        approvedByAdminId: ctx.id,
        approvedAt: new Date(),
      },
    });
    await this.audit.log(
      ctx,
      'jobs',
      'approved',
      `Approved job ${job.title}`,
      req,
    );
    const updated = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        department: true,
        owner: { include: { employerProfile: true } },
      },
    });
    return adminOk(mapJobRow(updated!, await this.jobExtras(jobId)));
  }

  async rejectJob(
    ctx: AdminContext,
    jobId: string,
    body: Record<string, unknown>,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VERIFY_JOBS);
    if (!body.reason) adminBadRequest('reason is required.');
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) adminNotFound('Job not found.');
    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: jobId },
        data: { status: JobStatus.REJECTED },
      }),
      this.prisma.rejectionReason.create({
        data: {
          targetType: SubmissionTargetType.JOB,
          targetId: jobId,
          reasonText: String(body.reason),
          rejectedByAdminId: ctx.id,
        },
      }),
    ]);
    await this.audit.log(
      ctx,
      'jobs',
      'rejected',
      `Rejected job ${job.title}`,
      req,
    );
    const updated = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        department: true,
        owner: { include: { employerProfile: true } },
      },
    });
    return adminOk(mapJobRow(updated!, await this.jobExtras(jobId)));
  }

  async updateJobStatus(
    ctx: AdminContext,
    jobId: string,
    body: Record<string, unknown>,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_JOBS);
    const status = jobStatusFromAdminApi(body.status);
    if (!status) adminBadRequest('Valid status is required.');
    if (status === JobStatus.ACTIVE)
      adminBadRequest('Use /approve for rejected→live transitions.');
    await this.prisma.job.update({ where: { id: jobId }, data: { status } });
    await this.audit.log(
      ctx,
      'jobs',
      'updated',
      `Updated job ${jobId} status`,
      req,
    );
    const updated = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        department: true,
        owner: { include: { employerProfile: true } },
      },
    });
    if (!updated) adminNotFound('Job not found.');
    return adminOk(mapJobRow(updated, await this.jobExtras(jobId)));
  }

  async listDocuments(ctx: AdminContext, query: Record<string, unknown>) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VERIFY_DOCUMENTS);
    const q = parseListQuery(query);
    const where: Record<string, unknown> = {};
    if (query.status) {
      const s = String(query.status).toLowerCase();
      if (s === 'approved')
        where.verificationStatus = VerificationStatus.VERIFIED;
      else if (s === 'rejected')
        where.verificationStatus = VerificationStatus.REJECTED;
      else if (s === 'resubmitted')
        where.verificationStatus = VerificationStatus.CHANGES_REQUESTED;
      else
        where.verificationStatus = {
          in: [VerificationStatus.PENDING, VerificationStatus.UNDER_REVIEW],
        };
    }
    if (query.reviewerId) where.reviewerAdminId = String(query.reviewerId);
    const [rows, total] = await Promise.all([
      this.prisma.employerDocument.findMany({
        where,
        include: {
          employer: { include: { workerProfile: true, employerProfile: true } },
          reviewer: true,
        },
        orderBy: { createdAt: q.order },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.employerDocument.count({ where }),
    ]);
    return adminPaged(rows.map(mapDocumentRow), q.page, q.limit, total);
  }

  async getDocument(ctx: AdminContext, id: string) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VERIFY_DOCUMENTS);
    const row = await this.prisma.employerDocument.findUnique({
      where: { id },
      include: {
        employer: { include: { workerProfile: true, employerProfile: true } },
        reviewer: true,
      },
    });
    if (!row) adminNotFound('Document not found.');
    return adminOk(mapDocumentRow(row));
  }

  async approveDocument(ctx: AdminContext, id: string, req: Request) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VERIFY_DOCUMENTS);
    await this.prisma.employerDocument.update({
      where: { id },
      data: {
        verificationStatus: VerificationStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedByAdminId: ctx.id,
        reviewerAdminId: ctx.id,
      },
    });
    await this.audit.log(
      ctx,
      'documents',
      'approved',
      `Approved document ${id}`,
      req,
    );
    return this.getDocument(ctx, id);
  }

  async rejectDocument(
    ctx: AdminContext,
    id: string,
    body: Record<string, unknown>,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VERIFY_DOCUMENTS);
    if (!body.reason) adminBadRequest('reason is required.');
    await this.prisma.employerDocument.update({
      where: { id },
      data: {
        verificationStatus: VerificationStatus.REJECTED,
        verificationNotes: String(body.reason),
        reviewerAdminId: ctx.id,
      },
    });
    await this.audit.log(
      ctx,
      'documents',
      'rejected',
      `Rejected document ${id}`,
      req,
    );
    return this.getDocument(ctx, id);
  }

  async listDepartments(ctx: AdminContext, query: Record<string, unknown>) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_DEPARTMENTS);
    const q = parseListQuery(query);
    const where: Record<string, unknown> = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total, jobsWithoutDepartment] = await Promise.all([
      this.prisma.department.findMany({
        where,
        include: { _count: { select: { jobs: true } } },
        orderBy: { name: q.order },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.department.count({ where }),
      this.prisma.job.count({ where: { departmentId: null } }),
    ]);
    const mapped = await Promise.all(
      rows.map(async (dept) => {
        const [applicationsCount, hiresCount] = await Promise.all([
          this.prisma.application.count({
            where: { job: { departmentId: dept.id } },
          }),
          this.prisma.application.count({
            where: {
              job: { departmentId: dept.id },
              status: ApplicationStatus.HIRED,
            },
          }),
        ]);
        return mapDepartmentRow(dept, { applicationsCount, hiresCount });
      }),
    );
    return adminPaged(mapped, q.page, q.limit, total, {
      summary: { jobsWithoutDepartment },
    });
  }

  async getDepartment(ctx: AdminContext, id: string) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_DEPARTMENTS);
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { jobs: true } } },
    });
    if (!dept) adminNotFound('Department not found.');
    const [applicationsCount, hiresCount] = await Promise.all([
      this.prisma.application.count({
        where: { job: { departmentId: id } },
      }),
      this.prisma.application.count({
        where: {
          job: { departmentId: id },
          status: ApplicationStatus.HIRED,
        },
      }),
    ]);
    return adminOk(mapDepartmentRow(dept, { applicationsCount, hiresCount }));
  }

  async createDepartment(
    ctx: AdminContext,
    body: Record<string, unknown>,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_DEPARTMENTS);
    if (!body.name || !body.description)
      adminBadRequest('name and description are required.');
    const name = String(body.name);
    if (isReservedOtherDepartmentName(name)) {
      adminBadRequest('Department name "Other" is reserved.');
    }
    const dept = await this.prisma.department.create({
      data: {
        name,
        slug: `${slugify(name)}-${Date.now()}`,
        description: String(body.description),
        category: DepartmentCategory.SOFTWARE_TECH,
        isActive: true,
        createdByAdminId: ctx.id,
      },
      include: { _count: { select: { jobs: true } } },
    });
    await this.audit.log(
      ctx,
      'departments',
      'created',
      `Created department ${dept.name}`,
      req,
    );
    return adminOk(mapDepartmentRow(dept));
  }

  async updateDepartment(
    ctx: AdminContext,
    id: string,
    body: Record<string, unknown>,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_DEPARTMENTS);
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) adminNotFound('Department not found.');
    const data: Record<string, unknown> = {};
    if (body.name) {
      const name = String(body.name);
      if (isReservedOtherDepartmentName(name)) {
        adminBadRequest('Department name "Other" is reserved.');
      }
      data.name = name;
      data.slug = slugify(name);
    }
    if (body.description) data.description = String(body.description);
    const updated = await this.prisma.department.update({
      where: { id },
      data,
      include: { _count: { select: { jobs: true } } },
    });
    await this.audit.log(
      ctx,
      'departments',
      'updated',
      `Updated department ${updated.name}`,
      req,
    );
    const [applicationsCount, hiresCount] = await Promise.all([
      this.prisma.application.count({
        where: { job: { departmentId: id } },
      }),
      this.prisma.application.count({
        where: {
          job: { departmentId: id },
          status: ApplicationStatus.HIRED,
        },
      }),
    ]);
    return adminOk(
      mapDepartmentRow(updated, { applicationsCount, hiresCount }),
    );
  }

  async deleteDepartment(ctx: AdminContext, id: string, req: Request) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_DEPARTMENTS);
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) adminNotFound('Department not found.');
    const live = await this.prisma.job.count({
      where: { departmentId: id, status: JobStatus.ACTIVE },
    });
    if (live > 0) {
      adminConflict('Cannot delete department with active jobs.');
    }
    await this.prisma.department.delete({ where: { id } });
    await this.audit.log(
      ctx,
      'departments',
      'deleted',
      `Deleted department ${dept.name}`,
      req,
    );
    return adminOk({ deleted: true });
  }

  async listUsers(ctx: AdminContext, query: Record<string, unknown>) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_PLATFORM_USERS);
    const q = parseListQuery(query);
    const where: Record<string, unknown> = {};
    if (query.role) where.role = String(query.role).toUpperCase();
    if (query.isActive !== undefined) {
      where.accountStatus =
        String(query.isActive) === 'true'
          ? AccountStatus.ACTIVE
          : AccountStatus.SUSPENDED;
    }
    if (query.country) where.country = String(query.country);
    if (query.city) where.city = String(query.city);
    if (q.search) {
      where.OR = [
        { email: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search } },
        {
          workerProfile: {
            fullName: { contains: q.search, mode: 'insensitive' },
          },
        },
        {
          employerProfile: {
            companyName: { contains: q.search, mode: 'insensitive' },
          },
        },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { workerProfile: true, employerProfile: true },
        orderBy: { createdAt: q.order },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return adminPaged(rows.map(mapPlatformUser), q.page, q.limit, total);
  }

  async getUser(ctx: AdminContext, userId: string) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_PLATFORM_USERS);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { workerProfile: true, employerProfile: true },
    });
    if (!user) adminNotFound('User not found.');
    return adminOk(mapPlatformUser(user));
  }

  async suspendUser(ctx: AdminContext, userId: string, req: Request) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_PLATFORM_USERS);
    const label = await this.userDisplayLabel(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: AccountStatus.SUSPENDED },
    });
    await this.audit.log(
      ctx,
      'users',
      'suspended',
      `Suspended user ${label}`,
      req,
    );
    return this.getUser(ctx, userId);
  }

  async activateUser(ctx: AdminContext, userId: string, req: Request) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_PLATFORM_USERS);
    const label = await this.userDisplayLabel(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: AccountStatus.ACTIVE },
    });
    await this.audit.log(
      ctx,
      'users',
      'updated',
      `Activated user ${label}`,
      req,
    );
    return this.getUser(ctx, userId);
  }

  async deleteUser(ctx: AdminContext, userId: string, req: Request) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_PLATFORM_USERS);
    const label = await this.userDisplayLabel(userId);
    await this.prisma.user.delete({ where: { id: userId } });
    await this.audit.log(ctx, 'users', 'deleted', `Deleted user ${label}`, req);
    return adminOk({ deleted: true });
  }

  private async userDisplayLabel(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { workerProfile: true, employerProfile: true },
    });
    if (!user) return userId;
    if (user.role === Role.WORKER) {
      return user.workerProfile?.fullName ?? user.email ?? userId;
    }
    return user.employerProfile?.companyName ?? user.email ?? userId;
  }

  async listProfiles(ctx: AdminContext, query: Record<string, unknown>) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.CREATE_PROFILES);
    const q = parseListQuery(query);
    const where: Record<string, unknown> = { ...profileScopeWhere(ctx) };
    if (query.createdByAdmin) {
      const creatorId = String(query.createdByAdmin);
      if (!ctx.isSuperAdmin && creatorId !== ctx.id) {
        adminForbidden('You can only filter profiles you created.');
      }
      where.createdByAdminId = creatorId;
    }
    if (query.isAdminCreated === 'true') where.createdByAdminId = { not: null };
    const roleFilter = query.role || query.profileType;
    if (roleFilter) where.role = String(roleFilter).toUpperCase();
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { workerProfile: true, employerProfile: true },
        orderBy: { createdAt: q.order },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    const items = rows.map((u) => this.mapProfile(u));
    return adminPaged(items, q.page, q.limit, total);
  }

  private mapProfile(user: {
    id: string;
    email: string | null;
    phone: string | null;
    accountStatus: AccountStatus;
    createdByAdminId: string | null;
    createdAt: Date;
    role: Role;
    workerProfile: {
      id: string;
      fullName: string | null;
      professionalTitle: string | null;
      shortBio: string | null;
      city: string | null;
      region: string | null;
      country: string | null;
      profileViews: number;
      dateOfBirth: Date | null;
      verificationStatus: VerificationStatus;
    } | null;
    employerProfile: {
      id: string;
      companyName: string;
      description: string | null;
      city: string | null;
      region: string | null;
      country: string | null;
      verificationStatus: VerificationStatus;
    } | null;
  }) {
    const isWorker = user.role === Role.WORKER;
    const profile = isWorker ? user.workerProfile : user.employerProfile;
    const verificationStatus = isWorker
      ? user.workerProfile?.verificationStatus
      : user.employerProfile?.verificationStatus;
    return {
      id: profile?.id ?? user.id,
      userId: user.id,
      profileType: isWorker ? 'worker' : 'employer',
      fullName: isWorker
        ? user.workerProfile?.fullName
        : user.employerProfile?.companyName,
      email: user.email,
      phone: user.phone,
      photoUrl: null,
      dateOfBirth: user.workerProfile?.dateOfBirth
        ? user.workerProfile.dateOfBirth.toISOString().slice(0, 10)
        : null,
      accountStatus:
        user.accountStatus === AccountStatus.SUSPENDED ? 'suspended' : 'active',
      city: profile && 'city' in profile ? profile.city : null,
      region: profile && 'region' in profile ? profile.region : null,
      country: profile && 'country' in profile ? profile.country : null,
      isVerified: verificationStatus === VerificationStatus.VERIFIED,
      verificationStatus: verificationStatus?.toLowerCase() ?? 'pending',
      isAdminCreated: Boolean(user.createdByAdminId),
      createdByAdmin: user.createdByAdminId,
      memberSince: user.createdAt.toISOString(),
      profileViews: isWorker ? user.workerProfile?.profileViews : undefined,
      shortBio: isWorker
        ? user.workerProfile?.shortBio
        : user.employerProfile?.description,
      organization: isWorker ? undefined : user.employerProfile?.companyName,
      role: isWorker ? user.workerProfile?.professionalTitle : undefined,
      profile,
    };
  }

  async getProfile(ctx: AdminContext, profileId: string) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.CREATE_PROFILES);
    const user = await this.findProfileUser(profileId, ctx);
    return adminOk(this.mapProfile(user));
  }

  private async findProfileUser(profileId: string, ctx: AdminContext) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { workerProfile: { id: profileId } },
          { employerProfile: { id: profileId } },
          { id: profileId },
        ],
        ...profileScopeWhere(ctx),
      },
      include: { workerProfile: true, employerProfile: true },
    });
    if (!user) adminNotFound('Profile not found.');
    return user;
  }

  async createProfile(
    ctx: AdminContext,
    body: Record<string, unknown>,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.CREATE_PROFILES);
    const profileType = String(body.profileType || '').toLowerCase();
    if (!['worker', 'employer'].includes(profileType))
      adminBadRequest('profileType must be worker or employer.');
    for (const key of ['fullName', 'email', 'phone', 'locationRegionCity']) {
      if (!body[key]) adminBadRequest(`${key} is required.`);
    }
    const tempPassword = `Ja${Math.random().toString(36).slice(2, 10)}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const [cityPart, regionPart] = String(body.locationRegionCity)
      .split('/')
      .map((s) => s.trim());
    const user = await this.prisma.user.create({
      data: {
        email: String(body.email).toLowerCase(),
        phone: String(body.phone),
        passwordHash,
        role: profileType === 'worker' ? Role.WORKER : Role.EMPLOYER,
        accountStatus: AccountStatus.ACTIVE,
        preferredLanguage: PreferredLanguage.ENG,
        createdByAdminId: ctx.id,
        city: cityPart || String(body.locationRegionCity),
        region: regionPart || null,
        ...(profileType === 'worker'
          ? {
              workerProfile: {
                create: {
                  fullName: String(body.fullName),
                  professionalTitle: String(body.roleOrPosition || ''),
                  shortBio: body.shortBio ? String(body.shortBio) : null,
                  verificationStatus: VerificationStatus.VERIFIED,
                },
              },
            }
          : {
              employerProfile: {
                create: {
                  companyName: String(body.organization || body.fullName),
                  contactPersonName: String(body.fullName),
                  description: body.shortBio ? String(body.shortBio) : null,
                  verificationStatus: VerificationStatus.VERIFIED,
                },
              },
            }),
      },
      include: { workerProfile: true, employerProfile: true },
    });
    await this.audit.log(
      ctx,
      'profiles',
      'created',
      `Created ${profileType} profile ${user.id}`,
      req,
    );
    return adminOk(this.mapProfile(user));
  }

  async updateProfile(
    ctx: AdminContext,
    profileId: string,
    body: Record<string, unknown>,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.CREATE_PROFILES);
    const user = await this.findProfileUser(profileId, ctx);
    if (!user.createdByAdminId)
      adminForbidden('Only admin-created profiles can be edited.');
    if (user.role === Role.WORKER && user.workerProfile) {
      await this.prisma.workerProfile.update({
        where: { id: user.workerProfile.id },
        data: {
          fullName: body.fullName ? String(body.fullName) : undefined,
          professionalTitle: body.roleOrPosition
            ? String(body.roleOrPosition)
            : undefined,
          shortBio: body.shortBio ? String(body.shortBio) : undefined,
        },
      });
    } else if (user.employerProfile) {
      await this.prisma.employerProfile.update({
        where: { id: user.employerProfile.id },
        data: {
          companyName: body.organization
            ? String(body.organization)
            : undefined,
          contactPersonName: body.fullName ? String(body.fullName) : undefined,
          description: body.shortBio ? String(body.shortBio) : undefined,
        },
      });
    }
    await this.audit.log(
      ctx,
      'profiles',
      'updated',
      `Updated profile ${profileId}`,
      req,
    );
    return this.getProfile(ctx, profileId);
  }

  async suspendProfile(ctx: AdminContext, profileId: string, req: Request) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.CREATE_PROFILES);
    const user = await this.findProfileUser(profileId, ctx);
    if (!user.createdByAdminId)
      adminForbidden('Only admin-created profiles can be suspended.');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { accountStatus: AccountStatus.SUSPENDED },
    });
    await this.audit.log(
      ctx,
      'profiles',
      'suspended',
      `Suspended profile ${profileId}`,
      req,
    );
    return this.getProfile(ctx, profileId);
  }

  async activateProfile(ctx: AdminContext, profileId: string, req: Request) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.CREATE_PROFILES);
    const user = await this.findProfileUser(profileId, ctx);
    if (!user.createdByAdminId)
      adminForbidden('Only admin-created profiles can be activated.');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { accountStatus: AccountStatus.ACTIVE },
    });
    await this.audit.log(
      ctx,
      'profiles',
      'updated',
      `Activated profile ${profileId}`,
      req,
    );
    return this.getProfile(ctx, profileId);
  }

  async deleteProfile(ctx: AdminContext, profileId: string, req: Request) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.CREATE_PROFILES);
    const user = await this.findProfileUser(profileId, ctx);
    if (!user.createdByAdminId)
      adminForbidden('Only admin-created profiles can be deleted.');
    await this.prisma.user.delete({ where: { id: user.id } });
    await this.audit.log(
      ctx,
      'profiles',
      'deleted',
      `Deleted profile ${profileId}`,
      req,
    );
    return adminOk({ deleted: true });
  }

  async listDisputes(ctx: AdminContext, query: Record<string, unknown>) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.RESOLVE_DISPUTES);
    const q = parseListQuery(query);
    const where: Record<string, unknown> = {
      ...this.disputeDepartmentWhere(ctx),
    };
    if (query.status) {
      const s = parseDisputeStatus(query.status);
      if (s) where.status = s;
    }
    if (query.priority) {
      const p = parseDisputePriority(query.priority);
      if (p) where.priority = p;
    }
    if (query.departmentId) {
      where.engagement = { job: { departmentId: String(query.departmentId) } };
    }
    const [rows, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        include: {
          raisedBy: { include: { workerProfile: true, employerProfile: true } },
          against: { include: { workerProfile: true, employerProfile: true } },
          engagement: { include: { job: true } },
        },
        orderBy: { createdAt: q.order },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.dispute.count({ where }),
    ]);
    return adminPaged(rows.map(mapDisputeRow), q.page, q.limit, total);
  }

  async getDispute(ctx: AdminContext, id: string) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.RESOLVE_DISPUTES);
    const row = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        raisedBy: { include: { workerProfile: true, employerProfile: true } },
        against: { include: { workerProfile: true, employerProfile: true } },
        engagement: { include: { job: true } },
      },
    });
    if (!row) adminNotFound('Dispute not found.');
    return adminOk(mapDisputeRow(row));
  }

  async resolveDispute(
    ctx: AdminContext,
    id: string,
    body: Record<string, unknown>,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.RESOLVE_DISPUTES);
    const decision = parseDisputeDecision(body.resolutionDecision);
    if (!decision) adminBadRequest('resolutionDecision is required.');
    if (!body.resolutionNotes) adminBadRequest('resolutionNotes is required.');
    await this.prisma.dispute.update({
      where: { id },
      data: {
        status: DisputeStatus.RESOLVED,
        resolutionDecision: decision,
        resolutionNotes: String(body.resolutionNotes),
        resolution: String(body.resolutionNotes),
        adminNotes: body.adminNotes ? String(body.adminNotes) : undefined,
        refundAmount: body.refundAmount ? Number(body.refundAmount) : undefined,
        refundChannel: body.refundChannel
          ? (String(body.refundChannel).toUpperCase() as never)
          : undefined,
        resolvedByAdminId: ctx.id,
        resolvedAt: new Date(),
      },
    });
    await this.audit.log(
      ctx,
      'disputes',
      'resolved',
      `Resolved dispute ${id}`,
      req,
    );
    return this.getDispute(ctx, id);
  }

  async listFinanceRecords(ctx: AdminContext, query: Record<string, unknown>) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VIEW_FINANCIAL_RECORDS);
    const q = parseListQuery(query);
    const where: Record<string, unknown> = {};
    if (query.status) where.status = String(query.status).toUpperCase();
    if (query.provider)
      where.mobileMoneyProvider = String(query.provider).toUpperCase();
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          worker: { include: { workerProfile: true } },
          payer: { include: { employerProfile: true } },
          engagement: { include: { job: true } },
        },
        orderBy: { initiatedAt: q.order },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return adminPaged(rows.map(mapPaymentRecord), q.page, q.limit, total);
  }

  async getFinanceRecord(ctx: AdminContext, id: string) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VIEW_FINANCIAL_RECORDS);
    const row = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        worker: { include: { workerProfile: true } },
        payer: { include: { employerProfile: true } },
        engagement: { include: { job: true } },
      },
    });
    if (!row) adminNotFound('Transaction not found.');
    return adminOk(mapPaymentRecord(row));
  }

  async financeSummary(ctx: AdminContext) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.VIEW_FINANCIAL_RECORDS);
    const completed = await this.prisma.payment.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
      _count: { id: true },
    });
    return adminOk({
      totalTransactions: completed._count.id,
      totalAmountIn: Number(completed._sum.amount ?? 0),
      totalAmountOut: 0,
      netBalance: Number(completed._sum.amount ?? 0),
    });
  }

  async listAdmins(ctx: AdminContext, query: Record<string, unknown>) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_ADMINS);
    const q = parseListQuery(query);
    const where: Record<string, unknown> = {};
    if (query.role) {
      const role = parseAdminRole(query.role);
      if (role) where.role = role;
    }
    if (q.search) {
      where.OR = [
        { fullName: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.adminAccount.findMany({
        where,
        include: {
          permissions: true,
          departmentLinks: {
            include: { department: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: q.order },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.adminAccount.count({ where }),
    ]);
    return adminPaged(rows.map(mapAdminRow), q.page, q.limit, total);
  }

  async getAdmin(ctx: AdminContext, adminId: string) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_ADMINS);
    const row = await this.prisma.adminAccount.findUnique({
      where: { id: adminId },
      include: {
        permissions: true,
        departmentLinks: {
          include: { department: { select: { id: true, name: true } } },
        },
      },
    });
    if (!row) adminNotFound('Admin not found.');
    return adminOk(mapAdminRow(row));
  }

  async createAdmin(
    ctx: AdminContext,
    body: Record<string, unknown>,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_ADMINS);
    const role = parseAdminRole(body.role);
    if (!body.fullName || !body.email || !role) {
      adminBadRequest('fullName, email, and role are required.');
    }
    const password = resolveAdminPassword(body.password);
    const admin = await this.prisma.adminAccount.create({
      data: {
        fullName: String(body.fullName),
        email: String(body.email).toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12),
        role: role,
        isActive: true,
        invitePending: false,
        createdByAdminId: ctx.id,
        permissions: {
          create: defaultPermissionsForRole(role).map((permission) => ({
            permission,
          })),
        },
        ...(body.departmentId
          ? {
              departmentLinks: {
                create: { departmentId: String(body.departmentId) },
              },
            }
          : {}),
      },
      include: {
        permissions: true,
        departmentLinks: {
          include: { department: { select: { id: true, name: true } } },
        },
      },
    });
    await this.audit.log(
      ctx,
      'admins',
      'created',
      `Created admin ${admin.email}`,
      req,
    );
    return adminOk(mapAdminRow(admin));
  }

  async updateAdmin(
    ctx: AdminContext,
    adminId: string,
    body: Record<string, unknown>,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_ADMINS);
    const existing = await this.prisma.adminAccount.findUnique({
      where: { id: adminId },
    });
    if (!existing) adminNotFound('Admin not found.');
    if (existing.role === AdminRole.SUPER_ADMIN) {
      if (body.role) adminBadRequest('Super admin role cannot be changed.');
      if (body.password && !ctx.isSuperAdmin) {
        adminForbidden(
          'Only super admin can reset another super admin password.',
        );
      }
    }
    const nextRole = body.role ? parseAdminRole(body.role) : undefined;
    if (body.role && !nextRole) {
      adminBadRequest(
        'role must be admin_manager, verifier, or support_agent.',
      );
    }
    if (nextRole === AdminRole.SUPER_ADMIN) {
      adminBadRequest('Super admin role cannot be assigned.');
    }
    if (body.password) {
      if (!ctx.isSuperAdmin) {
        adminForbidden('Only super admin can reset admin passwords.');
      }
      const password = String(body.password).trim();
      if (password.length < 8) {
        adminBadRequest('Password must be at least 8 characters.');
      }
    }
    const updated = await this.prisma.adminAccount.update({
      where: { id: adminId },
      data: {
        fullName: body.fullName ? String(body.fullName) : undefined,
        email: body.email ? String(body.email).toLowerCase() : undefined,
        role: nextRole,
        ...(body.password && ctx.isSuperAdmin
          ? {
              passwordHash: await bcrypt.hash(String(body.password).trim(), 12),
            }
          : {}),
      },
      include: {
        permissions: true,
        departmentLinks: {
          include: { department: { select: { id: true, name: true } } },
        },
      },
    });
    await this.audit.log(
      ctx,
      'admins',
      'updated',
      `Updated admin ${adminId}`,
      req,
    );
    return adminOk(mapAdminRow(updated));
  }

  async suspendAdmin(ctx: AdminContext, adminId: string, req: Request) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_ADMINS);
    const existing = await this.prisma.adminAccount.findUnique({
      where: { id: adminId },
    });
    if (!existing) adminNotFound('Admin not found.');
    if (existing.role === AdminRole.SUPER_ADMIN)
      adminBadRequest('Super admin cannot be suspended.');
    await this.prisma.adminAccount.update({
      where: { id: adminId },
      data: { isActive: false },
    });
    await this.audit.log(
      ctx,
      'admins',
      'suspended',
      `Suspended admin ${adminId}`,
      req,
    );
    return this.getAdmin(ctx, adminId);
  }

  async activateAdmin(ctx: AdminContext, adminId: string, req: Request) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_ADMINS);
    await this.prisma.adminAccount.update({
      where: { id: adminId },
      data: { isActive: true, invitePending: false },
    });
    await this.audit.log(
      ctx,
      'admins',
      'updated',
      `Activated admin ${adminId}`,
      req,
    );
    return this.getAdmin(ctx, adminId);
  }

  async deleteAdmin(ctx: AdminContext, adminId: string, req: Request) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_ADMINS);
    const existing = await this.prisma.adminAccount.findUnique({
      where: { id: adminId },
    });
    if (!existing) adminNotFound('Admin not found.');
    if (existing.role === AdminRole.SUPER_ADMIN)
      adminBadRequest('Super admin cannot be deleted.');
    await this.prisma.adminAccount.delete({ where: { id: adminId } });
    await this.audit.log(
      ctx,
      'admins',
      'deleted',
      `Deleted admin ${adminId}`,
      req,
    );
    return adminOk({ deleted: true });
  }

  async listPermissions(ctx: AdminContext, query: Record<string, unknown>) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_ADMINS);
    const q = parseListQuery(query);
    const where: Record<string, unknown> = {};
    if (query.role) {
      const role = parseAdminRole(query.role);
      if (role) where.role = role;
    }
    if (query.adminId) where.id = String(query.adminId);
    const [rows, total] = await Promise.all([
      this.prisma.adminAccount.findMany({
        where,
        include: {
          permissions: true,
          departmentLinks: {
            include: { department: { select: { id: true, name: true } } },
          },
        },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.adminAccount.count({ where }),
    ]);
    const items = rows.map((a) => ({
      adminId: a.id,
      name: a.fullName,
      email: a.email,
      role: a.role.toLowerCase(),
      permissions: a.permissions.map((p) => p.permission),
      departments: a.departmentLinks.map((d) => d.department),
    }));
    return adminPaged(items, q.page, q.limit, total);
  }

  async getPermissions(ctx: AdminContext, adminId: string) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_ADMINS);
    const admin = await this.prisma.adminAccount.findUnique({
      where: { id: adminId },
      include: {
        permissions: true,
        departmentLinks: {
          include: { department: { select: { id: true, name: true } } },
        },
      },
    });
    if (!admin) adminNotFound('Admin not found.');
    return adminOk({
      adminId: admin.id,
      permissions: admin.permissions.map((p) => p.permission),
      departments: admin.departmentLinks.map((d) => d.department),
    });
  }

  async replacePermissions(
    ctx: AdminContext,
    adminId: string,
    body: Record<string, unknown>,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_ADMINS);
    const admin = await this.prisma.adminAccount.findUnique({
      where: { id: adminId },
    });
    if (!admin) adminNotFound('Admin not found.');
    const permissions = Array.isArray(body.permissions)
      ? body.permissions.map(String)
      : [];
    const departmentIds = Array.isArray(body.departmentIds)
      ? body.departmentIds.map(String)
      : [];
    const effectivePerms =
      admin.role === AdminRole.SUPER_ADMIN
        ? defaultPermissionsForRole(AdminRole.SUPER_ADMIN)
        : permissions;

    await this.prisma.$transaction([
      this.prisma.adminPermissionRow.deleteMany({ where: { adminId } }),
      this.prisma.adminDepartmentAssignment.deleteMany({ where: { adminId } }),
      this.prisma.adminPermissionRow.createMany({
        data: effectivePerms.map((permission) => ({ adminId, permission })),
      }),
      ...(departmentIds.length
        ? [
            this.prisma.adminDepartmentAssignment.createMany({
              data: departmentIds.map((departmentId) => ({
                adminId,
                departmentId,
              })),
            }),
          ]
        : []),
    ]);
    await this.audit.log(
      ctx,
      'permissions',
      'updated',
      `Updated permissions for ${adminId}`,
      req,
    );
    return this.getPermissions(ctx, adminId);
  }

  async grantPermission(
    ctx: AdminContext,
    adminId: string,
    body: Record<string, unknown>,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_ADMINS);
    if (!body.permission) adminBadRequest('permission is required.');
    await this.prisma.adminPermissionRow.upsert({
      where: {
        adminId_permission: { adminId, permission: String(body.permission) },
      },
      create: { adminId, permission: String(body.permission) },
      update: {},
    });
    await this.audit.log(
      ctx,
      'permissions',
      'updated',
      `Granted ${body.permission} to ${adminId}`,
      req,
    );
    return this.getPermissions(ctx, adminId);
  }

  async revokePermission(
    ctx: AdminContext,
    adminId: string,
    permission: string,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_ADMINS);
    const admin = await this.prisma.adminAccount.findUnique({
      where: { id: adminId },
    });
    if (admin?.role === AdminRole.SUPER_ADMIN)
      adminBadRequest('Cannot revoke super admin permissions.');
    await this.prisma.adminPermissionRow.deleteMany({
      where: { adminId, permission },
    });
    await this.audit.log(
      ctx,
      'permissions',
      'updated',
      `Revoked ${permission} from ${adminId}`,
      req,
    );
    return this.getPermissions(ctx, adminId);
  }

  async assignDepartment(
    ctx: AdminContext,
    adminId: string,
    body: Record<string, unknown>,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_ADMINS);
    if (!body.departmentId) adminBadRequest('departmentId is required.');
    await this.prisma.adminDepartmentAssignment.upsert({
      where: {
        adminId_departmentId: {
          adminId,
          departmentId: String(body.departmentId),
        },
      },
      create: { adminId, departmentId: String(body.departmentId) },
      update: {},
    });
    await this.audit.log(
      ctx,
      'permissions',
      'updated',
      `Assigned department to ${adminId}`,
      req,
    );
    return this.getPermissions(ctx, adminId);
  }

  async unassignDepartment(
    ctx: AdminContext,
    adminId: string,
    deptId: string,
    req: Request,
  ) {
    this.adminContext.requirePermission(ctx, ADMIN_PERM.MANAGE_ADMINS);
    await this.prisma.adminDepartmentAssignment.deleteMany({
      where: { adminId, departmentId: deptId },
    });
    await this.audit.log(
      ctx,
      'permissions',
      'updated',
      `Removed department from ${adminId}`,
      req,
    );
    return this.getPermissions(ctx, adminId);
  }
}

function resolveAdminPassword(value: unknown): string {
  const password =
    typeof value === 'string' && value.trim()
      ? value.trim()
      : DEFAULT_ADMIN_PASSWORD;
  if (password.length < 8) {
    adminBadRequest('Password must be at least 8 characters.');
  }
  return password;
}
