import { fetchJson } from '../../lib/fetch-json.mjs';

export const WORKER_PREFIX = '/worker';
export const EMPLOYER_PREFIX = '/employer';

/**
 * @param {string} base
 * @param {string} path
 * @param {Parameters<typeof fetchJson>[2]} [opts]
 */
export function workerFetch(base, path, opts = {}) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return fetchJson(base, `${WORKER_PREFIX}${suffix}`, opts);
}

/**
 * @param {string} base
 * @param {string} path
 * @param {Parameters<typeof fetchJson>[2]} [opts]
 */
export function employerFetch(base, path, opts = {}) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return fetchJson(base, `${EMPLOYER_PREFIX}${suffix}`, opts);
}

/**
 * @param {string} base
 * @param {string} path
 * @param {{
 *   method?: string;
 *   bearer?: string;
 *   jar?: Record<string, string>;
 *   fields?: Record<string, string>;
 *   fileField?: string;
 *   fileName?: string;
 *   buffer?: Buffer;
 *   mime?: string;
 * }} opts
 */
export async function fetchMultipart(base, path, opts = {}) {
  const {
    method = 'POST',
    bearer,
    jar,
    fields = {},
    fileField = 'file',
    fileName = 'test.png',
    buffer,
    mime = 'image/png',
  } = opts;
  const url = `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) form.append(k, v);
  }
  if (buffer) {
    const blob = new Blob([buffer], { type: mime });
    form.append(fileField, blob, fileName);
  }
  const headers = { Accept: 'application/json' };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const res = await fetch(url, { method, headers, body: form });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

/** @param {unknown} body */
export function hasPaginatedData(body) {
  return (
    body &&
    typeof body === 'object' &&
    Array.isArray(/** @type {{ data?: unknown[] }} */ (body).data) &&
    typeof /** @type {{ page?: number }} */ (body).page === 'number'
  );
}
