import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class EarningsFilterDto {
  @IsOptional() @IsString() from?: string; // ISO date string
  @IsOptional() @IsString() to?: string; // ISO date string
  @IsOptional() @IsString() engagementId?: string;

  @IsOptional()
  @IsIn(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'])
  status?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number =
    20;
}
