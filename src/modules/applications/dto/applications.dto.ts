import {
  IsString,
  IsOptional,
  IsArray,
  //   IsUUID,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMIZE PROFILE FOR A SPECIFIC JOB (pre-apply step)
// ─────────────────────────────────────────────────────────────────────────────

export class CustomizeProfileDto {
  @IsOptional()
  @IsString()
  professionalSummary?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workHistoryIds?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT APPLICATION
// ─────────────────────────────────────────────────────────────────────────────

export class SubmitApplicationDto {
  @IsOptional()
  @IsString()
  jobSpecificNote?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachedDocuments?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKER APPLICATION LIST FILTERS
// ─────────────────────────────────────────────────────────────────────────────

export class ApplicationFilterDto {
  @IsOptional()
  @IsIn(['SUBMITTED', 'SHORTLISTED', 'HIRED', 'REJECTED'])
  status?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number =
    20;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYER — UPDATE APPLICATION STATUS
// ─────────────────────────────────────────────────────────────────────────────

export class UpdateApplicationStatusDto {
  @IsIn(['SHORTLISTED', 'HIRED', 'REJECTED'])
  status!: string;

  @IsOptional()
  @IsString()
  employerNotes?: string;
}
