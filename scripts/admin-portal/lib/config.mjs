/**
 * Admin portal smoke tests — API base URL.
 * Defaults to deployed Render API (override with API_URL / BASE_URL in .env).
 */

export const DEFAULT_ADMIN_API_URL = 'https://joballa-api.onrender.com';

export function getBaseUrl() {
  const raw = process.env.API_URL?.trim() || DEFAULT_ADMIN_API_URL;
  return raw.replace(/\/$/, '');
}

/** True when targeting a non-local host (skip unsafe Prisma bootstrap unless opted in). */
export function isRemoteApi(base = getBaseUrl()) {
  try {
    const host = new URL(base).hostname;
    return host !== 'localhost' && host !== '127.0.0.1';
  } catch {
    return true;
  }
}
