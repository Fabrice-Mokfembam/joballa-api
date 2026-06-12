import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class VerifyRegistrationDto {
  @IsString()
  identifier!: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  otp?: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  code?: string;

  @IsOptional()
  @IsIn(['registration'])
  purpose?: 'registration';
}
