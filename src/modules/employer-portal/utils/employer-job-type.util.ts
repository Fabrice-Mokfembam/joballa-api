import { JobType, PayStructure } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

const EMPLOYMENT_TYPE_MAP: Record<string, JobType> = {
  'full-time': JobType.FULL_TIME,
  'full time': JobType.FULL_TIME,
  full_time: JobType.FULL_TIME,
  [JobType.FULL_TIME]: JobType.FULL_TIME,
  'part-time': JobType.PART_TIME,
  'part time': JobType.PART_TIME,
  part_time: JobType.PART_TIME,
  [JobType.PART_TIME]: JobType.PART_TIME,
  contract: JobType.CONTRACT,
  [JobType.CONTRACT]: JobType.CONTRACT,
  casual: JobType.CASUAL,
  [JobType.CASUAL]: JobType.CASUAL,
  seasonal: JobType.SEASONAL,
  [JobType.SEASONAL]: JobType.SEASONAL,
  internship: JobType.INTERNSHIP,
  [JobType.INTERNSHIP]: JobType.INTERNSHIP,
};

const PAY_PER_MAP: Record<string, PayStructure> = {
  hour: PayStructure.HOURLY,
  hourly: PayStructure.HOURLY,
  [PayStructure.HOURLY]: PayStructure.HOURLY,
  day: PayStructure.DAILY,
  daily: PayStructure.DAILY,
  [PayStructure.DAILY]: PayStructure.DAILY,
  week: PayStructure.WEEKLY,
  weekly: PayStructure.WEEKLY,
  [PayStructure.WEEKLY]: PayStructure.WEEKLY,
  month: PayStructure.MONTHLY,
  monthly: PayStructure.MONTHLY,
  [PayStructure.MONTHLY]: PayStructure.MONTHLY,
  fixed: PayStructure.FIXED,
  [PayStructure.FIXED]: PayStructure.FIXED,
};

export function parseEmploymentType(value: string): JobType {
  const key = value.trim().toLowerCase();
  const mapped = EMPLOYMENT_TYPE_MAP[key] ?? EMPLOYMENT_TYPE_MAP[value.trim()];
  if (!mapped) {
    throw new BadRequestException(
      `Invalid employmentType. Use one of: ${Object.values(JobType).join(', ')}`,
    );
  }
  return mapped;
}

export function parsePayPer(value: string): PayStructure {
  const key = value.trim().toLowerCase();
  const mapped = PAY_PER_MAP[key] ?? PAY_PER_MAP[value.trim()];
  if (!mapped) {
    throw new BadRequestException(
      `Invalid per value. Use Hour, Day, Week, Month, or FIXED pay structure.`,
    );
  }
  return mapped;
}

export function jobTypeToDisplay(jobType: JobType): string {
  return jobType.replace(/_/g, '-').toLowerCase();
}

export function payStructureToPer(payStructure: PayStructure): string {
  switch (payStructure) {
    case PayStructure.HOURLY:
      return 'Hour';
    case PayStructure.DAILY:
      return 'Day';
    case PayStructure.WEEKLY:
      return 'Week';
    case PayStructure.MONTHLY:
      return 'Month';
    default:
      return 'Fixed';
  }
}
