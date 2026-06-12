import { cookieHeaderFromJar, mergeSetCookieIntoJar } from './cookie-jar.mjs';

/**
 * @param {string} base
 * @param {string} path
 * @param {{
 *   method?: string;
 *   body?: unknown;
 *   bearer?: string;
 *   jar?: Record<string, string>;
 * }} [opts]
 */
export async function fetchJson(base, path, opts = {}) {
  const { method = 'GET', body, bearer, jar } = opts;
  const url = `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = { Accept: 'application/json' };
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
  }
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }
  const ch = jar ? cookieHeaderFromJar(jar) : undefined;
  if (ch) {
    headers.Cookie = ch;
  }

  const res = await fetch(url, {
    method,
    headers,
    body:
      body !== undefined && method !== 'GET' && method !== 'HEAD'
        ? JSON.stringify(body)
        : undefined,
  });

  if (jar) mergeSetCookieIntoJar(res, jar);

  const text = await res.text();
  /** @type {unknown} */
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}
