import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsInt,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { JobType, WorkMode, PayStructure } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// JOB SEARCH / LISTING FILTERS
// ─────────────────────────────────────────────────────────────────────────────

const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === 'all' || s.toLowerCase() === 'any') {
    return undefined;
  }
  return s;
};

export class JobSearchDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  keyword?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  city?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  category?: string;
  @IsOptional() @IsEnum(JobType) jobType?: JobType;
  @IsOptional() @IsEnum(WorkMode) workMode?: WorkMode;
  @IsOptional() @IsEnum(PayStructure) payStructure?: PayStructure;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPay?: number;

  @IsOptional()
  @IsIn(['createdAt', 'payRate'])
  sortBy?: 'createdAt' | 'payRate';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number =
    20;
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB REPORT
// ─────────────────────────────────────────────────────────────────────────────

export class ReportJobDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYER — CREATE JOB
// ─────────────────────────────────────────────────────────────────────────────

export class CreateJobDto {
  @IsString() title!: string;
  @IsString() description!: string;
  @IsString() category!: string;
  @IsEnum(JobType) jobType!: JobType;
  @IsOptional() @IsEnum(WorkMode) workMode?: WorkMode;
  @IsString() location!: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() neighbourhood?: string;

  @Type(() => Number)
  payRate!: number;

  @IsEnum(PayStructure) payStructure!: PayStructure;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() startAsap?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) durationValue?: number;
  @IsOptional() @IsString() durationUnit?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) numberOfOpenings?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) requiredSkills?: string[];
  @IsOptional() @IsString() requiredLevel?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) requirements?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsibilities?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requestedDocuments?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYER — UPDATE JOB
// ─────────────────────────────────────────────────────────────────────────────

export class UpdateJobDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsEnum(JobType) jobType?: JobType;
  @IsOptional() @IsEnum(WorkMode) workMode?: WorkMode;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() neighbourhood?: string;
  @IsOptional() @Type(() => Number) payRate?: number;
  @IsOptional() @IsEnum(PayStructure) payStructure?: PayStructure;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() startAsap?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() durationValue?: number;
  @IsOptional() @IsString() durationUnit?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) numberOfOpenings?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) requiredSkills?: string[];
  @IsOptional() @IsString() requiredLevel?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) requirements?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsibilities?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requestedDocuments?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYER — JOB LIST FILTERS
// ─────────────────────────────────────────────────────────────────────────────

export class EmployerJobFilterDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number =
    20;
}
