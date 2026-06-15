import { IsIn, IsString, MinLength } from 'class-validator';

export class UpsertPushTokenDto {
  @IsString()
  @MinLength(10)
  token!: string;

  @IsString()
  @IsIn(['ios', 'android', 'unknown'])
  platform!: 'ios' | 'android' | 'unknown';
}
