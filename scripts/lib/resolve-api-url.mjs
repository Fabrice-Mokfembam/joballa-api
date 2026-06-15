/**
 * Resolve API base URL from environment (no hardcoded production host).
 * Priority: API_URL → JOBALLA_API_URL → NEXT_PUBLIC_API_BASE_URL → EXPO_PUBLIC_API_BASE_URL
 */

export function resolveApiUrl(options = {}) {
  const { localFlag, localPort } = options;

  if (localFlag && process.env[localFlag] === '1') {
    const port = process.env.PORT ?? localPort ?? '8000';
    return `http://127.0.0.1:${port}`.replace(/\/$/, '');
  }

  const raw =
    process.env.API_URL?.trim() ||
    process.env.JOBALLA_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (!raw) {
    throw new Error(
      'API URL not configured. Set API_URL (or NEXT_PUBLIC_API_BASE_URL) in joballa-api/.env',
    );
  }

  return raw.replace(/\/$/, '');
}
