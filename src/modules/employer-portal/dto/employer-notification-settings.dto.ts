import { IsBoolean, IsOptional } from 'class-validator';

export class EmployerNotificationSettingsDto {
  @IsOptional() @IsBoolean() pushEnabled?: boolean;
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @IsOptional() @IsBoolean() applicantsEnabled?: boolean;
  @IsOptional() @IsBoolean() messagesEnabled?: boolean;
}
