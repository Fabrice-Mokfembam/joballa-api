import {
  AccountStatus,
  ApplicationStatus,
  DepartmentCategory,
  DocumentFileType,
  EmploymentType,
  EngagementStatus,
  InformalRequestStatus,
  JobStatus,
  MomoProvider,
  NotificationType,
  PayStructure,
  PreferredLanguage,
  Role,
  SubmissionTier,
  VerificationStatus,
  WorkMode,
} from '@prisma/client';

export type PageResult<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function pageParams(page?: unknown, limit?: unknown) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  return { page: p, limit: l, skip: (p - 1) * l };
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PageResult<T> {
  return {
    data,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export function roleToApi(role: Role) {
  return role === Role.WORKER ? 'worker' : 'employer';
}

export function languageToApi(language: PreferredLanguage) {
  return language === PreferredLanguage.FRE ? 'fre' : 'eng';
}

export function accountStatusToApi(status: AccountStatus) {
  if (status === AccountStatus.SUSPENDED) return 'suspended';
  if (status === AccountStatus.DEACTIVATED) return 'deactivated';
  return 'active';
}

export function verificationToApi(status: VerificationStatus) {
  return status.toLowerCase();
}

export function employmentTypeToApi(value: EmploymentType) {
  return value.toLowerCase();
}

export function workModeToApi(value: WorkMode) {
  return value.toLowerCase();
}

export function payStructureToApi(value: PayStructure) {
  return value.toLowerCase();
}

export function jobStatusToApi(value: JobStatus) {
  return value.toLowerCase();
}

export function applicationStatusToApi(value: ApplicationStatus) {
  return value.toLowerCase();
}

export function engagementStatusToApi(value: EngagementStatus) {
  return value.toLowerCase();
}

export function providerToApi(value: MomoProvider) {
  return value.toLowerCase();
}

export function documentTypeToApi(value: DocumentFileType) {
  return value.toLowerCase();
}

export function notificationTypeToApi(value: NotificationType) {
  return value.toLowerCase();
}

export function informalStatusToApi(value: InformalRequestStatus) {
  return value.toLowerCase();
}

export function departmentCategoryToApi(value: DepartmentCategory) {
  return value.toLowerCase();
}

export function tierToApi(value: SubmissionTier) {
  return value.toLowerCase();
}

export function parseEnum<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
): T[keyof T] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).trim().toUpperCase();
  return enumObject[normalized as keyof T] as T[keyof T] | undefined;
}

export function fileTypeFromMime(mime: string): DocumentFileType {
  return mime === 'application/pdf'
    ? DocumentFileType.PDF
    : DocumentFileType.IMAGE;
}
