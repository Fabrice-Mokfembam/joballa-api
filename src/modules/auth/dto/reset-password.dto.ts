import { IsOptional, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
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

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
