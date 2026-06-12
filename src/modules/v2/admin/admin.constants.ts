import { AdminRole } from '@prisma/client';

export const ADMIN_PERM = {
  VIEW_PLATFORM_LOGS: 'view_platform_logs',
  VIEW_PLATFORM_ANALYTICS: 'view_platform_analytics',
  MANAGE_ADMINS: 'manage_admins',
  MANAGE_JOBS: 'manage_jobs',
  MANAGE_PLATFORM_USERS: 'manage_platform_users',
  VERIFY_JOBS: 'verify_jobs',
  MANAGE_DEPARTMENTS: 'manage_departments',
  RESOLVE_DISPUTES: 'resolve_disputes',
  VERIFY_DOCUMENTS: 'verify_documents',
  VERIFY_KYC: 'verify_kyc',
  VIEW_FINANCIAL_RECORDS: 'view_financial_records',
  CREATE_PROFILES: 'create_profiles',
} as const;

export type AdminPermissionKey = (typeof ADMIN_PERM)[keyof typeof ADMIN_PERM];

export const ALL_ADMIN_PERMISSIONS: AdminPermissionKey[] =
  Object.values(ADMIN_PERM);

const MANAGER_PERMS: AdminPermissionKey[] = [
  ADMIN_PERM.VIEW_PLATFORM_LOGS,
  ADMIN_PERM.VIEW_PLATFORM_ANALYTICS,
  ADMIN_PERM.MANAGE_JOBS,
  ADMIN_PERM.MANAGE_PLATFORM_USERS,
  ADMIN_PERM.VERIFY_JOBS,
  ADMIN_PERM.MANAGE_DEPARTMENTS,
  ADMIN_PERM.RESOLVE_DISPUTES,
  ADMIN_PERM.VERIFY_DOCUMENTS,
  ADMIN_PERM.VERIFY_KYC,
  ADMIN_PERM.VIEW_FINANCIAL_RECORDS,
  ADMIN_PERM.CREATE_PROFILES,
];

const VERIFIER_PERMS: AdminPermissionKey[] = [
  ADMIN_PERM.VERIFY_JOBS,
  ADMIN_PERM.RESOLVE_DISPUTES,
  ADMIN_PERM.VERIFY_DOCUMENTS,
  ADMIN_PERM.VERIFY_KYC,
];

const SUPPORT_PERMS: AdminPermissionKey[] = [ADMIN_PERM.CREATE_PROFILES];

export function defaultPermissionsForRole(
  role: AdminRole,
): AdminPermissionKey[] {
  if (role === AdminRole.SUPER_ADMIN) return [...ALL_ADMIN_PERMISSIONS];
  if (role === AdminRole.ADMIN_MANAGER) return [...MANAGER_PERMS];
  if (role === AdminRole.VERIFIER) return [...VERIFIER_PERMS];
  return [...SUPPORT_PERMS];
}

export function roleToApi(role: AdminRole): string {
  return role.toLowerCase();
}

export const ADMIN_REFRESH_COOKIE = 'adminRefreshToken';

export const ADMIN_JWT_TYP = 'admin';

/** Used when POST /admin/admins omits `password`, and for CLI bootstrap. */
export const DEFAULT_ADMIN_PASSWORD = 'Joballa+Admin2026!';
