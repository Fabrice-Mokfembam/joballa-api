import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
  IsInt,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ApplicationStatus,
  JobType,
  PayStructure,
  JobStatus,
} from '@prisma/client';

export class WorkerCreateJobDto {
  @IsString() title!: string;
  @IsOptional() @IsString() category?: string;
  @IsString() city!: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() neighbourhood?: string;
  @IsString() description!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) requiredSkills?: string[];
  @IsOptional() @IsString() requiredLevel?: string;
  @IsEnum(JobType) jobType!: JobType;
  @IsOptional() @IsInt() durationValue?: number;
  @IsOptional() @IsString() durationUnit?: string;
  @IsInt() @Min(0) payRate!: number;
  @IsOptional() @IsString() currency?: string;
  @IsEnum(PayStructure) payStructure!: PayStructure;
  @IsOptional() @IsInt() @Min(1) numberOfOpenings?: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsBoolean() startAsap?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) requirements?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsibilities?: string[];
  @IsOptional() @IsBoolean() asDraft?: boolean;
}

export class WorkerUpdateJobDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) requiredSkills?: string[];
  @IsOptional() @IsInt() @Min(0) payRate?: number;
  @IsOptional() @IsBoolean() asDraft?: boolean;
}

export class WorkerJobFilterDto {
  @IsOptional() @IsEnum(JobStatus) status?: JobStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number =
    20;
}

export class WorkerJobStatusDto {
  @IsEnum(JobStatus) status!: JobStatus;
}

export class WorkerIncomingApplicationsDto {
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsString() jobId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number =
    20;
}
