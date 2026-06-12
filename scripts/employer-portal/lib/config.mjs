/**
 * Employer portal smoke tests — API base URL.
 */

export const DEFAULT_EMPLOYER_API_URL = 'https://joballa-api.onrender.com';

export function getBaseUrl() {
  const raw = process.env.API_URL?.trim() || DEFAULT_EMPLOYER_API_URL;
  return raw.replace(/\/$/, '');
}

export function isRemoteApi(base = getBaseUrl()) {
  try {
    const host = new URL(base).hostname;
    return host !== 'localhost' && host !== '127.0.0.1';
  } catch {
    return true;
  }
}
