#!/usr/bin/env node
/**
 * End-to-end auth flow checks (run against a **local** Nest server with DB).
 *
 * Prerequisites
 * - API running (e.g. `npm run dev`).
 * - Set `JOBALLA_DEV_FIXED_OTP` on the **server** (six digits). Never use in production.
 *   OTPs are bcrypt-hashed in the DB, so automation cannot read the real code otherwise.
 *
 * Env
 * - API_URL / BASE_URL — default http://127.0.0.1:$PORT ($PORT default 5000)
 *
 * Usage
 *   node scripts/test-auth-flows.mjs
 */

import { getBaseUrl } from './lib/config.mjs';
import { loadRootDotenvOptional } from './lib/dotenv-lite.mjs';
import { fetchJson } from './lib/fetch-json.mjs';

loadRootDotenvOptional();

const base = getBaseUrl();
const FIXED_OTP = (process.env.JOBALLA_DEV_FIXED_OTP ?? '').trim();

let failed = false;

function fail(step, detail) {
  failed = true;
  console.error(`FAIL — ${step}`);
  if (detail !== undefined) console.error(detail);
}

function ok(step) {
  console.log(`OK   — ${step}`);
}

function assert(cond, step, detail) {
  if (!cond) fail(step, detail);
  else ok(step);
}

if (!/^[0-9]{6}$/.test(FIXED_OTP)) {
  console.error(
    [
      'Set JOBALLA_DEV_FIXED_OTP to six digits on the Nest server (.env).',
      'Example (non-production only): JOBALLA_DEV_FIXED_OTP=555555',
      'Then rerun — this script uses the same value for OTP steps.',
    ].join('\n'),
  );
  process.exit(1);
}

const suffix = `${Date.now()}`;
const email = `authflow-${suffix}@example.test`;
const password = `TestPass99!${suffix.slice(-6)}`;
const role = 'WORKER';
const languagePreference = 'EN';
const canonical = email.toLowerCase();
const wrongOtp = String((Number.parseInt(FIXED_OTP, 10) + 1) % 1_000_000).padStart(
  6,
  '0',
);

console.log(`Base URL: ${base}`);
console.log(`Test user: ${email} (${role})`);
console.log('');

const jar = /** @type {Record<string, string>} */ ({});

// --- POST /auth/register
{
  const r = await fetchJson(base, '/auth/register', {
    method: 'POST',
    body: { email, password, role, languagePreference },
  });
  assert(
    r.ok && r.data?.identifier === canonical,
    'POST /auth/register',
    `${r.status} ${JSON.stringify(r.data)}`,
  );
}

// --- POST /auth/verify — wrong OTP, then success
let accessToken = '';
{
  const bad = await fetchJson(base, '/auth/verify', {
    method: 'POST',
    jar,
    body: {
      identifier: canonical,
      otp: wrongOtp,
      role,
      password,
      languagePreference,
    },
  });
  assert(
    !bad.ok && bad.status === 400,
    'POST /auth/verify rejects wrong OTP',
    `${bad.status} ${JSON.stringify(bad.data)}`,
  );

  const r = await fetchJson(base, '/auth/verify', {
    method: 'POST',
    jar,
    body: {
      identifier: canonical,
      otp: FIXED_OTP,
      role,
      password,
      languagePreference,
    },
  });
  assert(
    r.ok &&
      r.status === 201 &&
      typeof r.data?.accessToken === 'string' &&
      r.data?.user?.id,
    'POST /auth/verify (creates user + refresh cookie)',
    `${r.status} ${JSON.stringify(r.data)}`,
  );
  accessToken = r.data.accessToken;
}

// --- GET /auth/me
{
  const r = await fetchJson(base, '/auth/me', {
    method: 'GET',
    bearer: accessToken,
  });
  assert(
    r.ok && r.data?.user?.id && r.data.user.email === canonical,
    'GET /auth/me',
    `${r.status} ${JSON.stringify(r.data)}`,
  );
}

// --- POST /auth/refresh
{
  const r = await fetchJson(base, '/auth/refresh', {
    method: 'POST',
    jar,
    body: {},
  });
  assert(
    r.ok && typeof r.data?.accessToken === 'string' && r.data.accessToken.length > 20,
    'POST /auth/refresh (rotates cookie + new access token)',
    `${r.status} ${JSON.stringify(r.data)}`,
  );
  accessToken = r.data.accessToken;
}

// --- POST /auth/refresh without cookie → 401
{
  const r = await fetchJson(base, '/auth/refresh', {
    method: 'POST',
    body: {},
  });
  assert(
    !r.ok && r.status === 401,
    'POST /auth/refresh without cookie → 401',
    `${r.status} ${JSON.stringify(r.data)}`,
  );
}

// --- POST /auth/logout
{
  const r = await fetchJson(base, '/auth/logout', {
    method: 'POST',
    bearer: accessToken,
    jar,
  });
  assert(
    r.ok && r.data?.message,
    'POST /auth/logout',
    `${r.status} ${JSON.stringify(r.data)}`,
  );
}

// Cookie should be cleared (jar updated by merge)
if (jar.refreshToken) {
  fail('refresh cookie cleared after logout', JSON.stringify(Object.keys(jar)));
} else {
  ok('refresh cookie absent in jar after logout');
}

// --- POST /auth/login again
{
  const r = await fetchJson(base, '/auth/login', {
    method: 'POST',
    jar,
    body: { identifier: canonical, password },
  });
  assert(
    r.ok && typeof r.data?.accessToken === 'string',
    'POST /auth/login',
    `${r.status} ${JSON.stringify(r.data)}`,
  );
  accessToken = r.data.accessToken;
}

// --- Forgot password + reset + login with new password
const password2 = `${password}Nx!`;
{
  const r = await fetchJson(base, '/auth/forgot-password', {
    method: 'POST',
    body: { identifier: canonical },
  });
  assert(
    r.ok && typeof r.data?.message === 'string',
    'POST /auth/forgot-password',
    `${r.status} ${JSON.stringify(r.data)}`,
  );
}

{
  const r = await fetchJson(base, '/auth/reset-password', {
    method: 'POST',
    body: {
      identifier: canonical,
      otp: FIXED_OTP,
      newPassword: password2,
    },
  });
  assert(
    r.ok,
    'POST /auth/reset-password',
    `${r.status} ${JSON.stringify(r.data)}`,
  );
}

{
  const badOld = await fetchJson(base, '/auth/login', {
    method: 'POST',
    jar,
    body: { identifier: canonical, password },
  });
  assert(
    !badOld.ok && badOld.status === 401,
    'POST /auth/login rejects old password after reset',
    `${badOld.status} ${JSON.stringify(badOld.data)}`,
  );
}

{
  delete jar.refreshToken;
  const r = await fetchJson(base, '/auth/login', {
    method: 'POST',
    jar,
    body: { identifier: canonical, password: password2 },
  });
  assert(
    r.ok && typeof r.data?.accessToken === 'string',
    'POST /auth/login with new password after reset',
    `${r.status} ${JSON.stringify(r.data)}`,
  );
  accessToken = r.data.accessToken;
}

// --- POST /auth/resend-otp (registration path, before duplicate account)
const emailB = `authflow-b-${suffix}@example.test`;
const jarB = /** @type {Record<string, string>} */ ({});
{
  const r = await fetchJson(base, '/auth/register', {
    method: 'POST',
    body: {
      email: emailB,
      password,
      role,
      languagePreference,
    },
  });
  assert(r.ok, 'POST /auth/register (user B)', `${r.status} ${JSON.stringify(r.data)}`);
}

{
  const r = await fetchJson(base, '/auth/resend-otp', {
    method: 'POST',
    body: {
      identifier: emailB.toLowerCase(),
      purpose: 'REGISTRATION',
    },
  });
  assert(
    r.ok && r.data?.identifier === emailB.toLowerCase(),
    'POST /auth/resend-otp (REGISTRATION)',
    `${r.status} ${JSON.stringify(r.data)}`,
  );
}

{
  const r = await fetchJson(base, '/auth/verify', {
    method: 'POST',
    jar: jarB,
    body: {
      identifier: emailB.toLowerCase(),
      otp: FIXED_OTP,
      role,
      password,
      languagePreference,
    },
  });
  assert(
    r.ok && r.status === 201 && r.data?.accessToken,
    'POST /auth/verify user B after resend',
    `${r.status} ${JSON.stringify(r.data)}`,
  );
}

console.log('');
if (failed) {
  console.error('Auth flow suite finished with failures.');
  process.exit(1);
}
console.log('Auth flow suite passed.');
process.exit(0);
