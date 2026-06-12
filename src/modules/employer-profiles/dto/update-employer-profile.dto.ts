import { MomoProvider } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpdateEmployerProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  industry?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string | null;

  @IsOptional()
  @IsUrl()
  logoUrl?: string | null;

  @IsOptional()
  @IsUrl()
  website?: string | null;

  @IsOptional()
  @IsString()
  about?: string | null;

  @IsOptional()
  @IsUrl()
  businessRegDocUrl?: string | null;

  @IsOptional()
  @IsEnum(MomoProvider)
  paymentProvider?: MomoProvider | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentAccount?: string | null;
}
