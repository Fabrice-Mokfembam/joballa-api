import { loadRootDotenvOptional } from '../../lib/dotenv-lite.mjs';
import { DEFAULT_ADMIN_API_URL } from './config.mjs';

/**
 * Load .env and set API target for admin smokes.
 * Default: deployed API (https://joballa-api.onrender.com).
 * Local API: set JOBALLA_ADMIN_USE_LOCAL=1 (optional API_URL or PORT).
 */
export function initAdminPortalEnv() {
  loadRootDotenvOptional();
  if (process.env.JOBALLA_ADMIN_USE_LOCAL === '1') {
    if (!process.env.API_URL?.trim()) {
      process.env.API_URL = `http://127.0.0.1:${process.env.PORT ?? '5000'}`;
    }
  } else {
    process.env.API_URL = DEFAULT_ADMIN_API_URL;
  }
}
