import {
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  industry?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  size?: string | null;

  @IsOptional()
  @IsString()
  bio?: string | null;

  @IsOptional()
  @IsObject()
  location?: { city?: string; country?: string } | null;

  @IsOptional()
  @IsUrl()
  website?: string | null;

  @IsOptional()
  @IsUrl()
  logo?: string | null;
}
