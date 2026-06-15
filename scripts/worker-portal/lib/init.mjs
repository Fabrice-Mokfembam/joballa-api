import { loadRootDotenvOptional } from '../../lib/dotenv-lite.mjs';
import { resolveApiUrl } from '../../lib/resolve-api-url.mjs';

/**
 * Load .env and set API target for worker smokes.
 * Remote: API_URL or NEXT_PUBLIC_API_BASE_URL in .env
 * Local: JOBALLA_WORKER_USE_LOCAL=1
 */
export function initWorkerPortalEnv() {
  loadRootDotenvOptional();
  process.env.API_URL = resolveApiUrl({ localFlag: 'JOBALLA_WORKER_USE_LOCAL' });
}
