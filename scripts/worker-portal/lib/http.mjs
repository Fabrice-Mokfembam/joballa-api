import { fetchJson } from '../../lib/fetch-json.mjs';

export const WORKER_API = '/api/worker';

/**
 * @param {string} base
 * @param {string} path — suffix after `/api/worker`
 * @param {Parameters<typeof fetchJson>[2]} [opts]
 */
export async function workerFetch(base, path, opts = {}) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return fetchJson(base, `${WORKER_API}${suffix}`, opts);
}

/**
 * @param {string} base
 * @param {string} path — absolute API path (e.g. `/api/jobs`)
 * @param {Parameters<typeof fetchJson>[2]} [opts]
 */
export async function apiFetch(base, path, opts = {}) {
  return fetchJson(base, path, opts);
}
