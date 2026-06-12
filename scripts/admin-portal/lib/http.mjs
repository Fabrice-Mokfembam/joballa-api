import { fetchJson } from '../../lib/fetch-json.mjs';

export const ADMIN_API = '/admin';

/**
 * Call admin API; unwraps `{ success, data, message }` when present.
 *
 * @param {string} base
 * @param {string} path — suffix after `/admin`
 * @param {Parameters<typeof fetchJson>[2]} [opts]
 */
export async function adminFetch(base, path, opts = {}) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const res = await fetchJson(base, `${ADMIN_API}${suffix}`, opts);
  if (
    res.ok &&
    res.data &&
    typeof res.data === 'object' &&
    res.data.success === true &&
    'data' in res.data
  ) {
    return {
      ...res,
      data: res.data.data,
      message: res.data.message,
      envelope: res.data,
    };
  }
  return res;
}

/**
 * @param {string} base
 * @param {string} identifier
 * @param {string} password
 * @param {Record<string, string>} [jar]
 */
export async function adminLogin(base, identifier, password, jar) {
  return adminFetch(base, '/auth/login', {
    method: 'POST',
    body: { identifier, password },
    jar,
  });
}
