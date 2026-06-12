#!/usr/bin/env node
/**
 * Employer portal — Company profile (3 routes)
 *   GET   /api/employer/company
 *   PATCH /api/employer/company
 *   POST  /api/employer/company/logo  (optional — skipped if SKIP_LOGO_UPLOAD=1)
 */
import { initEmployerPortalEnv } from './lib/init.mjs';
import { assert, exitCode } from './lib/assert.mjs';
import { employerFetch } from './lib/http.mjs';
import {
  bootstrapEmployerTestState,
  loadStateFromEnv,
  teardown,
} from './lib/bootstrap.mjs';

initEmployerPortalEnv();

/** 1×1 PNG */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * @param {string} base
 * @param {string} token
 */
async function uploadLogo(base, token) {
  const form = new FormData();
  const blob = new Blob([TINY_PNG], { type: 'image/png' });
  form.append('logo', blob, 'test-logo.png');

  const url = `${base.replace(/\/$/, '')}/api/employer/company/logo`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: form,
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

/**
 * @param {import('./lib/bootstrap.mjs').EmployerTestState} state
 */
export async function runCompanyTests(state) {
  console.log('\n=== Company profile ===\n');

  const get = await employerFetch(state.base, '/company', {
    bearer: state.employerToken,
  });
  assert(
    get.ok && get.data?.companyId && get.data?.name,
    'GET /api/employer/company',
    `${get.status} ${JSON.stringify(get.data)}`,
  );

  const patch = await employerFetch(state.base, '/company', {
    method: 'PATCH',
    bearer: state.employerToken,
    body: {
      name: get.data.name,
      industry: 'Software & Technology',
      size: '10-50 employees',
      bio: 'Employer portal integration test company.',
      location: { city: 'Douala', country: 'Cameroon' },
      website: 'https://example.test',
    },
  });
  assert(
    patch.ok && patch.data?.industry === 'Software & Technology',
    'PATCH /api/employer/company',
    `${patch.status} ${JSON.stringify(patch.data)}`,
  );

  const skipLogo =
    process.env.SKIP_LOGO_UPLOAD === '1' ||
    process.env.SKIP_LOGO_UPLOAD === 'true';
  if (skipLogo) {
    console.log('SKIP — POST /api/employer/company/logo (SKIP_LOGO_UPLOAD=1)');
  } else if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.warn(
      'SKIP — POST /api/employer/company/logo (CLOUDINARY_* not set in .env)',
    );
  } else {
    const logo = await uploadLogo(state.base, state.employerToken);
    assert(
      logo.ok && (logo.data?.logoUrl || logo.data?.secureUrl),
      'POST /api/employer/company/logo',
      `${logo.status} ${JSON.stringify(logo.data)}`,
    );
  }

  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    state = await bootstrapEmployerTestState({ seedApplication: false });
  }
  await runCompanyTests(state);
  await teardown();
  process.exit(exitCode());
}

import { isMain } from './lib/is-main.mjs';

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
