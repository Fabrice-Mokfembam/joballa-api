import { resolveApiUrl } from '../../lib/resolve-api-url.mjs';

/** Worker portal smoke tests — API base URL from env only. */
export function getBaseUrl() {
  return resolveApiUrl({ localFlag: 'JOBALLA_WORKER_USE_LOCAL' });
}

export function isRemoteApi(base = getBaseUrl()) {
  try {
    const host = new URL(base).hostname;
    return host !== 'localhost' && host !== '127.0.0.1';
  } catch {
    return true;
  }
}
