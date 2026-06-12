import { IsOptional, IsString, MinLength } from 'class-validator';

/** Optional body token when httpOnly cookie is unavailable (cross-origin SPA). */
export class RefreshSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(16)
  refreshToken?: string;
}
