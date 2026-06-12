import { IsIn, IsString } from 'class-validator';

export class ResendOtpDto {
  @IsString()
  identifier!: string;

  @IsIn(['registration', 'password_reset', 'REGISTRATION', 'PASSWORD_RESET'])
  purpose!: string;
}
