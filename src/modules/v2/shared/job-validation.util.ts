import { BadRequestException } from '@nestjs/common';
import {
  EmploymentType,
  ExperienceLevel,
  JobStatus,
  PayStructure,
  WorkMode,
} from '@prisma/client';
import { parseEnum } from './api-format';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type JobFieldErrors = Record<string, string[]>;

export type JobBodyInput = Record<string, unknown>;

export type JobRecordForPublish = {
  status: JobStatus;
  departmentId: string | null;
  title: string;
  employmentType: EmploymentType;
  workMode: WorkMode;
  country: string;
  city: string;
  payAmount: number;
  payCurrency: string;
  payStructure: PayStructure;
  description: string;
  startDate: Date | null;
  startNow: boolean;
};

export function parseOptionalDepartmentId(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const id = String(value).trim();
  if (!UUID_RE.test(id)) {
    throw new BadRequestException(
      'Invalid departmentId. Send the department UUID, not a slug or label.',
    );
  }
  return id;
}

export function parseRequiredDepartmentId(value: unknown): string {
  const id = parseOptionalDepartmentId(value);
  if (!id) {
    throw new BadRequestException('departmentId is required.');
  }
  return id;
}

export function parseOptionalJobDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(
      'Invalid startDate. Use ISO date YYYY-MM-DD, or omit startDate when startNow is true.',
    );
  }
  return parsed;
}

export function draftEmploymentType(value: unknown): EmploymentType {
  return parseEnum(EmploymentType, value) ?? EmploymentType.FULL_TIME;
}

export function draftPayStructure(value: unknown): PayStructure {
  return parseEnum(PayStructure, value) ?? PayStructure.MONTHLY;
}

export function requiredEnumForPublish<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
  field: string,
): T[keyof T] {
  const parsed = parseEnum(enumObject, value);
  if (!parsed) {
    throw new BadRequestException(`Invalid or missing ${field}.`);
  }
  return parsed;
}

export function validateJobForPublish(job: JobRecordForPublish): void {
  const fieldErrors: JobFieldErrors = {};

  if (!job.departmentId) {
    fieldErrors.departmentId = ['Department is required before publishing.'];
  }
  if (!String(job.title ?? '').trim()) {
    fieldErrors.title = ['Job title is required before publishing.'];
  }
  if (!String(job.city ?? '').trim()) {
    fieldErrors.city = ['City is required before publishing.'];
  }
  if (!String(job.description ?? '').trim()) {
    fieldErrors.description = [
      'Job description is required before publishing.',
    ];
  }
  if (!job.payAmount || job.payAmount <= 0) {
    fieldErrors.payAmount = ['Pay amount must be greater than zero.'];
  }
  if (!job.startNow && !job.startDate) {
    fieldErrors.startDate = ['Start date is required unless startNow is true.'];
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new BadRequestException({
      message: 'Job cannot be published until required fields are complete.',
      fieldErrors,
    });
  }
}

export function assertPublishableStatus(status: JobStatus): void {
  if (status !== JobStatus.DRAFT && status !== JobStatus.REJECTED) {
    throw new BadRequestException(
      'Only draft or rejected jobs can be submitted for review.',
    );
  }
}
