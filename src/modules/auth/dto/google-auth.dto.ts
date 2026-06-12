import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  @MinLength(20)
  idToken!: string;

  @IsIn(['signup', 'signin'])
  mode!: 'signup' | 'signin';

  @IsOptional()
  @IsIn(['worker', 'employer', 'WORKER', 'EMPLOYER'])
  role?: string;

  @IsOptional()
  @IsIn(['eng', 'fre', 'EN', 'FR', 'ENG', 'FRE'])
  preferredLanguage?: string;
}
