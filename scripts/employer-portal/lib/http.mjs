import { fetchJson } from '../../lib/fetch-json.mjs';

export const EMPLOYER_API = '/api/employer';

/**
 * @param {string} base
 * @param {string} path — suffix after `/api/employer`
 * @param {Parameters<typeof fetchJson>[2]} [opts]
 */
export async function employerFetch(base, path, opts = {}) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return fetchJson(base, `${EMPLOYER_API}${suffix}`, opts);
}
