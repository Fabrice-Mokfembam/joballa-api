import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsIn(['worker', 'employer', 'WORKER', 'EMPLOYER'])
  role!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(['eng', 'fre', 'EN', 'FR', 'ENG', 'FRE'])
  preferredLanguage!: string;
}
