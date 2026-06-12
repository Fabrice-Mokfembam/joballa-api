import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────────────────────────────────────
// LOG A SHIFT
// ─────────────────────────────────────────────────────────────────────────────

export class LogShiftDto {
  @IsDateString()
  date!: string;

  @Type(() => Number)
  hoursWorked!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// END ENGAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export class EndEngagementDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGAGEMENT LIST FILTER
// ─────────────────────────────────────────────────────────────────────────────

export class EngagementFilterDto {
  @IsOptional()
  @IsEnum({
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
    TERMINATED: 'TERMINATED',
  })
  status?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number =
    20;
}
