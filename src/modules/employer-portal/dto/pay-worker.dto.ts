import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PayWorkerDto {
  @IsString()
  workerId!: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  provider!: string;

  @IsString()
  phone!: string;

  @IsString()
  period!: string;
}
