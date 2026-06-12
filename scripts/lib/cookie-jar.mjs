/**
 * Minimal cookie jar for Node's native fetch (mirrors browser credentials for refreshToken).
 */

/**
 * @param {Response} res
 * @param {Record<string, string>} jar
 */
export function mergeSetCookieIntoJar(res, jar) {
  const list =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (() => {
          const v = res.headers.get('set-cookie');
          return v ? [v] : [];
        })();

  for (const line of list) {
    if (!line) continue;
    if (/[Mm]ax-[Aa]ge=0/.test(line)) {
      const nm = /^([^=]+)=/.exec(line);
      if (nm) delete jar[nm[1].trim()];
      continue;
    }
    const m = /^([^=]+)=([^;]*)/.exec(line);
    if (m) {
      const name = m[1].trim();
      const value = m[2].trim();
      jar[name] = value;
    }
  }
  return jar;
}

/**
 * @param {Record<string, string>} jar
 * @returns {string | undefined}
 */
export function cookieHeaderFromJar(jar) {
  if (!jar || Object.keys(jar).length === 0) return undefined;
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}
