import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateShiftDto {
  @IsDateString()
  date!: string;

  @IsNumber()
  @Min(0.5)
  hours!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
