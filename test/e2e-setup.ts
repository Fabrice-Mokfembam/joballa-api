import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../.env') });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'e2e-jwt-secret-dev-only-minimum-32-characters-long';
}
process.env.JWT_ACCESS_EXPIRES_SEC ||= '900';
process.env.JWT_REFRESH_EXPIRES_SEC ||= '604800';
process.env.OTP_EXPIRES_MINUTES ||= '10';
process.env.COOKIE_DOMAIN ||= 'localhost';
