import { loadRootDotenvOptional } from '../../lib/dotenv-lite.mjs';
import { resolveApiUrl } from '../../lib/resolve-api-url.mjs';

/**
 * Load .env and set API target for employer smokes.
 * Remote: API_URL or NEXT_PUBLIC_API_BASE_URL in .env
 * Local: JOBALLA_EMPLOYER_USE_LOCAL=1
 */
export function initEmployerPortalEnv() {
  loadRootDotenvOptional();
  process.env.API_URL = resolveApiUrl({ localFlag: 'JOBALLA_EMPLOYER_USE_LOCAL' });
}
