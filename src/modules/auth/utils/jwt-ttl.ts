import type { ConfigService } from '@nestjs/config';

/** Access JWT TTL in seconds. Primary: JWT_ACCESS_EXPIRES_SEC. Legacy: JWT_EXPIRES_SEC. Default 900 (15 min). */
export function accessTokenExpiresSeconds(config: ConfigService): number {
  const raw =
    config.get<string>('JWT_ACCESS_EXPIRES_SEC')?.trim() ||
    config.get<string>('JWT_EXPIRES_SEC')?.trim() ||
    '900';
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 900;
}

/** Refresh token / cookie max-age TTL in seconds. Default 604800 (7 days). */
export function refreshTokenExpiresSeconds(config: ConfigService): number {
  const raw = config.get<string>('JWT_REFRESH_EXPIRES_SEC')?.trim() || '604800';
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 604_800;
}
