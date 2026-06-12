#!/usr/bin/env node
/**
 * End-to-end smoke against the Joballa API (Nest must be running).
 *
 * Defaults: read-only (GET only). Writes are gated with env vars.
 *
 * Usage:
 *   node scripts/run-smoke-tests.mjs
 *   node scripts/run-smoke-tests.mjs --health-only
 *   node scripts/run-smoke-tests.mjs --token=<jwt>
 *
 * Env:
 *   API_URL / BASE_URL — Base URL (default http://127.0.0.1:$PORT or 5000)
 *   JOBALLA_ACCESS_TOKEN or ACCESS_TOKEN — Bearer JWT from /auth/login or /auth/register
 *
 * Optional: obtain token automatically (login):
 *   JOBALLA_SMOKE_LOGIN=1
 *   JOBALLA_SMOKE_IDENTIFIER — registered user email or phone
 *   JOBALLA_SMOKE_PASSWORD — password
 *
 * Optional writes:
 *   SMOKE_ENABLE_WRITES=1 — PATCH profile endpoints with tiny payloads
 */

import { getBaseUrl, getJoballaAccessToken } from './lib/config.mjs';

const base = getBaseUrl();

const argv = process.argv.slice(2);
const healthOnly = argv.includes('--health-only');
const smokeWrites =
  process.env.SMOKE_ENABLE_WRITES === '1' ||
  process.env.SMOKE_ENABLE_WRITES === 'true';

let failed = false;

function fail(step, detail) {
  failed = true;
  console.error(`FAIL: ${step}`);
  if (detail !== undefined) console.error(detail);
}

async function fetchJson(method, path, { body, token } = {}) {
  const url = `${base}${path}`;
  const headers = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const authHeader = token ?? bearerToken;
  if (authHeader) {
    headers.Authorization = `Bearer ${authHeader}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { ok: res.ok, status: res.status, data };
}

console.log(`Base URL: ${base}`);
console.log('');

async function stepHealth() {
  const htmlRes = await fetch(`${base}/`, { method: 'GET' });
  if (!htmlRes.ok) {
    fail(`GET ${base}/`, `${htmlRes.status} ${htmlRes.statusText}`);
    return;
  }
  const html = await htmlRes.text();
  console.log(`OK   GET ${base}/ (${html.length} chars HTML)`);
}

await stepHealth();

if (healthOnly) {
  process.exit(failed ? 1 : 0);
}

let bearerToken = getJoballaAccessToken();

if (!bearerToken && process.env.JOBALLA_SMOKE_LOGIN === '1') {
  const identifier = (
    process.env.JOBALLA_SMOKE_IDENTIFIER ??
    process.env.JOBALLA_SMOKE_EMAIL ??
    ''
  ).trim();
  const password = process.env.JOBALLA_SMOKE_PASSWORD ?? '';
  if (identifier && password) {
    const url = `${base}/auth/login`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier, password }),
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok || !data?.accessToken) {
      fail(
        'POST /auth/login (JOBALLA_SMOKE_LOGIN)',
        `${res.status} ${JSON.stringify(data)}`,
      );
    } else {
      bearerToken = data.accessToken;
      console.log(`OK   POST /auth/login (smoke env user)`);
    }
  }
}

console.log(
  `Access token: ${bearerToken ? '(set)' : '(missing — auth/profile routes skipped)'}`,
);
console.log('');

if (!bearerToken) {
  console.log(
    'Done (health only). Set JOBALLA_ACCESS_TOKEN or JOBALLA_SMOKE_LOGIN + JOBALLA_SMOKE_IDENTIFIER (+ password).',
  );
  process.exit(failed ? 1 : 0);
}

async function authMe(label) {
  const r = await fetchJson('GET', '/auth/me');
  if (!r.ok) {
    fail(`${label}: GET /auth/me`, `${r.status} ${JSON.stringify(r.data)}`);
    return null;
  }
  console.log(`OK   ${label} GET /auth/me`);
  if (typeof r.data === 'object' && r.data) {
    const u = r.data.user;
    console.log(
      `     role=${u?.role ?? 'n/a'} profileType=${r.data.profileType ?? 'n/a'}`,
    );
  }
  return r.data;
}

let state = await authMe('1.');

const role = state?.user?.role ?? null;

if (!failed && role === 'WORKER') {
  const g = await fetchJson('GET', '/worker-profiles/me');
  if (!g.ok) {
    fail('GET /worker-profiles/me', `${g.status} ${JSON.stringify(g.data)}`);
  } else {
    console.log(`OK   GET /worker-profiles/me`);
    if (smokeWrites && g.data && typeof g.data === 'object') {
      const patch = await fetchJson('PATCH', '/worker-profiles/me', {
        body: {
          bio: `Smoke ping ${new Date().toISOString()}`,
        },
      });
      if (!patch.ok) {
        fail(
          'PATCH /worker-profiles/me',
          `${patch.status} ${JSON.stringify(patch.data)}`,
        );
      } else {
        console.log(`OK   PATCH /worker-profiles/me (bio updated)`);
      }
    }
  }
} else if (!failed && role === 'EMPLOYER') {
  const g = await fetchJson('GET', '/employer-profiles/me');
  if (!g.ok) {
    fail(
      'GET /employer-profiles/me',
      `${g.status} ${JSON.stringify(g.data)}`,
    );
  } else {
    console.log(`OK   GET /employer-profiles/me`);
    if (smokeWrites && g.data && typeof g.data === 'object') {
      const patch = await fetchJson('PATCH', '/employer-profiles/me', {
        body: {
          about: `Smoke ping ${new Date().toISOString()}`,
        },
      });
      if (!patch.ok) {
        fail(
          'PATCH /employer-profiles/me',
          `${patch.status} ${JSON.stringify(patch.data)}`,
        );
      } else {
        console.log(`OK   PATCH /employer-profiles/me (about updated)`);
      }
    }
  }
} else if (!failed && bearerToken && role && role !== 'WORKER' && role !== 'EMPLOYER') {
  console.log(
    `SKIP profile routes — local role is ${role} (only WORKER / EMPLOYER tested here).`,
  );
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Smoke run finished.');
  if (!smokeWrites) {
    console.log('(Read-only mode. Set SMOKE_ENABLE_WRITES=1 to test PATCH.)');
  }
}
