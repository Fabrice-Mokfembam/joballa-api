import { HttpException } from '@nestjs/common';
import {
  AdminRole,
  DisputePriority,
  DisputeResolutionDecision,
  DisputeStatus,
  DisputeType,
  EmploymentType,
  ExperienceLevel,
  JobStatus,
  VerificationStatus,
  WorkMode,
} from '@prisma/client';

export type ListQuery = {
  page: number;
  limit: number;
  skip: number;
  sort: string;
  order: 'asc' | 'desc';
  search?: string;
  raw: Record<string, unknown>;
};

export function parseListQuery(query: Record<string, unknown>): ListQuery {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const sort = String(query.sort || 'createdAt');
  const orderRaw = String(query.order || 'desc').toLowerCase();
  const order = orderRaw === 'asc' ? 'asc' : 'desc';
  const search =
    query.search !== undefined && query.search !== ''
      ? String(query.search).trim()
      : undefined;
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    sort,
    order,
    search,
    raw: query,
  };
}

export function adminOk<T>(
  data: T,
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
) {
  if (meta) {
    return { success: true as const, data, meta };
  }
  return { success: true as const, data };
}

export function adminPaged<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
  extraMeta?: Record<string, unknown>,
) {
  const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  return adminOk(items, { page, limit, total, totalPages, ...extraMeta });
}

export function adminError(
  status: number,
  code: string,
  message: string,
): never {
  throw new HttpException({ success: false, error: { code, message } }, status);
}

export function adminForbidden(
  message = 'You do not have permission to perform this action.',
): never {
  adminError(403, 'FORBIDDEN', message);
}

export function adminUnauthorized(
  message = 'Invalid or expired admin session.',
): never {
  adminError(401, 'UNAUTHORIZED', message);
}

export function adminNotFound(message = 'Resource not found.'): never {
  adminError(404, 'NOT_FOUND', message);
}

export function adminBadRequest(message: string): never {
  adminError(400, 'BAD_REQUEST', message);
}

export function adminConflict(message: string): never {
  adminError(409, 'CONFLICT', message);
}

export function adminAccountSuspended(): never {
  adminError(403, 'ACCOUNT_SUSPENDED', 'Account suspended. Contact support.');
}

export function jobStatusToAdminApi(status: JobStatus): string {
  if (status === JobStatus.ACTIVE) return 'live';
  if (status === JobStatus.UNDER_REVIEW) return 'pending';
  return status.toLowerCase();
}

export function jobStatusFromAdminApi(value: unknown): JobStatus | undefined {
  const v = String(value || '').toLowerCase();
  if (v === 'live') return JobStatus.ACTIVE;
  if (v === 'pending') return JobStatus.UNDER_REVIEW;
  if (v === 'draft') return JobStatus.DRAFT;
  if (v === 'paused') return JobStatus.PAUSED;
  if (v === 'closed') return JobStatus.CLOSED;
  if (v === 'rejected') return JobStatus.REJECTED;
  return undefined;
}

export function kycStatusToAdminApi(status: VerificationStatus): string {
  if (status === VerificationStatus.VERIFIED) return 'verified';
  if (status === VerificationStatus.REJECTED) return 'rejected';
  return 'pending';
}

export function documentStatusToAdminApi(status: VerificationStatus): string {
  if (status === VerificationStatus.VERIFIED) return 'approved';
  if (status === VerificationStatus.REJECTED) return 'rejected';
  if (status === VerificationStatus.CHANGES_REQUESTED) return 'resubmitted';
  return 'pending_review';
}

export function disputeStatusToApi(status: DisputeStatus): string {
  return status.toLowerCase();
}

export function parseDisputeStatus(value: unknown): DisputeStatus | undefined {
  const v = String(value || '').toLowerCase();
  if (!v || v === 'all') return undefined;
  if (v === 'open' || v === 'in_review') return DisputeStatus.OPEN;
  if (v === 'resolved') return DisputeStatus.RESOLVED;
  if (v === 'closed') return DisputeStatus.CLOSED;
  return undefined;
}

export function parseDisputePriority(
  value: unknown,
): DisputePriority | undefined {
  const v = String(value || '').toLowerCase();
  if (v === 'low') return DisputePriority.LOW;
  if (v === 'medium') return DisputePriority.MEDIUM;
  if (v === 'high') return DisputePriority.HIGH;
  return undefined;
}

export function parseDisputeDecision(
  value: unknown,
): DisputeResolutionDecision | undefined {
  const v = String(value || '').toLowerCase();
  if (v === 'approve_worker') return DisputeResolutionDecision.APPROVE_WORKER;
  if (v === 'approve_employer')
    return DisputeResolutionDecision.APPROVE_EMPLOYER;
  if (v === 'partial') return DisputeResolutionDecision.PARTIAL;
  if (v === 'dismiss') return DisputeResolutionDecision.DISMISS;
  return undefined;
}

export function parseDisputeType(value: unknown): DisputeType | undefined {
  const v = String(value || '').toLowerCase();
  if (v === 'payment_issue') return DisputeType.PAYMENT_ISSUE;
  if (v === 'contract_breach') return DisputeType.CONTRACT_BREACH;
  if (v === 'harassment') return DisputeType.HARASSMENT;
  if (v === 'other') return DisputeType.OTHER;
  return undefined;
}

export function parseEmploymentType(
  value: unknown,
): EmploymentType | undefined {
  const v = String(value || '').toUpperCase();
  return (EmploymentType as Record<string, EmploymentType>)[v];
}

export function parseWorkMode(value: unknown): WorkMode | undefined {
  const v = String(value || '').toUpperCase();
  return (WorkMode as Record<string, WorkMode>)[v];
}

export function parseExperienceLevel(
  value: unknown,
): ExperienceLevel | undefined {
  const v = String(value || '').toUpperCase();
  return (ExperienceLevel as Record<string, ExperienceLevel>)[v];
}

export function adminRoleToApi(role: AdminRole): string {
  return role.toLowerCase();
}

export function parseAdminRole(value: unknown): AdminRole | undefined {
  const v = String(value || '').toUpperCase();
  if (v === 'SUPER_ADMIN') return AdminRole.SUPER_ADMIN;
  if (v === 'ADMIN_MANAGER') return AdminRole.ADMIN_MANAGER;
  if (v === 'VERIFIER') return AdminRole.VERIFIER;
  if (v === 'SUPPORT_AGENT') return AdminRole.SUPPORT_AGENT;
  return undefined;
}

export function isVerifiedUser(
  role: 'worker' | 'employer',
  workerStatus?: VerificationStatus | null,
  employerStatus?: VerificationStatus | null,
): boolean {
  const status = role === 'worker' ? workerStatus : employerStatus;
  return status === VerificationStatus.VERIFIED;
}

export function parseDashboardRange(query: Record<string, unknown>): {
  start: Date;
  end: Date;
} {
  const end = query.endDate ? new Date(String(query.endDate)) : new Date();
  if (query.startDate) {
    return { start: new Date(String(query.startDate)), end };
  }
  const range = String(query.range || '30d').toLowerCase();
  let days = 30;
  if (range === '7d') days = 7;
  else if (range === '90d') days = 90;
  else if (range === '1y' || range === '365d') days = 365;
  else {
    const match = range.match(/^(\d+)d$/);
    if (match) days = Math.max(1, Number(match[1]));
  }
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}
