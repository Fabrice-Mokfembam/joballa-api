import type { JobSearchDto } from '../dto/jobs.dto';

const PLACEHOLDER_VALUES = new Set([
  '',
  'all',
  'any',
  '*',
  'undefined',
  'null',
]);

function cleanOptionalString(value?: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = String(value).trim();
  if (!trimmed || PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) {
    return undefined;
  }
  return trimmed;
}

/** Drop empty / placeholder query params so the general feed is not over-filtered. */
export function sanitizeJobSearchDto(dto: JobSearchDto): JobSearchDto {
  return {
    page: dto.page,
    limit: dto.limit,
    sortBy: dto.sortBy,
    sortOrder: dto.sortOrder,
    jobType: dto.jobType,
    workMode: dto.workMode,
    payStructure: dto.payStructure,
    keyword: cleanOptionalString(dto.keyword),
    city: cleanOptionalString(dto.city),
    category: cleanOptionalString(dto.category),
    minPay:
      dto.minPay !== undefined && Number.isFinite(dto.minPay) && dto.minPay > 0
        ? dto.minPay
        : undefined,
    maxPay:
      dto.maxPay !== undefined && Number.isFinite(dto.maxPay) && dto.maxPay > 0
        ? dto.maxPay
        : undefined,
  };
}

export function hasJobSearchFilters(dto: JobSearchDto): boolean {
  return Boolean(
    dto.keyword ||
    dto.city ||
    dto.category ||
    dto.jobType ||
    dto.workMode ||
    dto.payStructure ||
    dto.minPay !== undefined ||
    dto.maxPay !== undefined,
  );
}
