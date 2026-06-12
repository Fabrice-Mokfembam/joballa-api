import { loadRootDotenvOptional } from '../../lib/dotenv-lite.mjs';
import { DEFAULT_EMPLOYER_API_URL } from './config.mjs';

/**
 * Load .env and set API target for employer smokes.
 * Default: https://joballa-api.onrender.com
 * Local: JOBALLA_EMPLOYER_USE_LOCAL=1
 */
export function initEmployerPortalEnv() {
  loadRootDotenvOptional();
  if (process.env.JOBALLA_EMPLOYER_USE_LOCAL === '1') {
    if (!process.env.API_URL?.trim()) {
      process.env.API_URL = `http://127.0.0.1:${process.env.PORT ?? '5000'}`;
    }
  } else {
    process.env.API_URL = DEFAULT_EMPLOYER_API_URL;
  }
}
