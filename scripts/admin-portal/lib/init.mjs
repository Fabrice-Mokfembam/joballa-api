import { loadRootDotenvOptional } from '../../lib/dotenv-lite.mjs';
import { resolveApiUrl } from '../../lib/resolve-api-url.mjs';

/**
 * Load .env and set API target for admin smokes.
 * Remote: API_URL or NEXT_PUBLIC_API_BASE_URL in .env
 * Local: JOBALLA_ADMIN_USE_LOCAL=1
 */
export function initAdminPortalEnv() {
  loadRootDotenvOptional();
  process.env.API_URL = resolveApiUrl({ localFlag: 'JOBALLA_ADMIN_USE_LOCAL' });
}
