import { IsOptional, IsString } from 'class-validator';

export class UpdateWorkforceStatusDto {
  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
