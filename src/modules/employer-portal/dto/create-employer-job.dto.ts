import { JobType, PayStructure } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEmployerJobDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  neighbourhood?: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsArray()
  @IsString({ each: true })
  requiredSkills!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  requiredLevel?: string;

  /** e.g. "Full Time" or `FULL_TIME` */
  @IsString()
  employmentType!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  durationUnit?: string;

  @IsNumber()
  @Min(0)
  pay!: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  /** e.g. Month, Day */
  @IsString()
  per!: string;

  @IsInt()
  @Min(1)
  numberOfOpenings!: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsBoolean()
  startAsap?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsibilities?: string[];

  /** When true, job stays DRAFT instead of submitted for review. */
  @IsOptional()
  @IsBoolean()
  asDraft?: boolean;

  /** Accept enum directly for internal/tests */
  @IsOptional()
  @IsEnum(JobType)
  jobType?: JobType;

  @IsOptional()
  @IsEnum(PayStructure)
  payStructure?: PayStructure;
}
