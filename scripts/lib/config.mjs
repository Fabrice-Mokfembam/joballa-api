/**
 * Shared options for smoke scripts.
 */

export function getBaseUrl() {
  const raw =
    process.env.API_URL ??
    process.env.BASE_URL ??
    `http://127.0.0.1:${process.env.PORT ?? '5000'}`;
  return raw.replace(/\/$/, '');
}

/** JWT from POST /auth/login or /auth/register (`accessToken` field). */
export function getJoballaAccessToken() {
  const argvToken = process.argv.find((arg) =>
    arg.startsWith('--token='),
  )?.slice('--token='.length);
  return (
    (
      process.env.JOBALLA_ACCESS_TOKEN ??
      process.env.ACCESS_TOKEN ??
      argvToken ??
      ''
    ).trim()
  );
}
