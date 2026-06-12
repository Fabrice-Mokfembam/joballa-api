#!/usr/bin/env node
/**
 * Worker routes not covered in 01–07 or previously skipped.
 *   POST   /api/worker/profile/avatar (stub)
 *   POST   /api/worker/profile/kyc
 *   DELETE /api/saved-jobs (bulk)
 *   GET    /api/worker/engagements/:engagementId (requires engagement row)
 */
import { initWorkerPortalEnv } from './lib/init.mjs';
import { assert, exitCode, skip } from './lib/assert.mjs';
import { apiFetch, workerFetch } from './lib/http.mjs';
import { fetchJson } from '../lib/fetch-json.mjs';
import { teardown } from './lib/bootstrap.mjs';
import { isMain } from './lib/is-main.mjs';

initWorkerPortalEnv();

/**
 * @param {string} base
 * @param {string} token
 */
export async function runExtraWorkerTests(base, token) {
  console.log('\n=== Worker — extra / previously skipped ===\n');

  const engagements = await apiFetch(
    base,
    '/api/worker/engagements?limit=10',
    { bearer: token },
  );
  assert(
    engagements.ok && Array.isArray(engagements.data?.items),
    'GET /api/worker/engagements (recheck)',
    `${engagements.status}`,
  );

  const engagementId = engagements.data?.items?.[0]?.id;
  if (engagementId) {
    const detail = await apiFetch(
      base,
      `/api/worker/engagements/${engagementId}`,
      { bearer: token },
    );
    assert(
      detail.ok && detail.data?.id === engagementId,
      'GET /api/worker/engagements/:engagementId',
      `${detail.status} ${JSON.stringify(detail.data)}`,
    );
  } else {
    skip(
      'GET /api/worker/engagements/:engagementId',
      'no engagement for this worker',
    );
  }

  const search = await apiFetch(base, '/api/jobs?page=1&limit=3', {
    bearer: token,
  });
  assert(
    search.ok && Array.isArray(search.data?.items),
    'GET /api/jobs (recheck after seed)',
    `${search.status}`,
  );

  const jobIds = (search.data?.items ?? [])
    .slice(0, 3)
    .map((j) => j.id)
    .filter(Boolean);

  for (const jobId of jobIds) {
    await apiFetch(base, `/api/jobs/${jobId}/save`, {
      method: 'POST',
      bearer: token,
    });
  }

  if (jobIds.length >= 2) {
    const bulkDel = await apiFetch(base, '/api/saved-jobs', {
      method: 'DELETE',
      bearer: token,
      body: { jobIds: jobIds.slice(0, 2) },
    });
    assert(
      bulkDel.ok || bulkDel.status === 204,
      'DELETE /api/saved-jobs (bulk)',
      `${bulkDel.status}`,
    );
  } else {
    skip('DELETE /api/saved-jobs (bulk)', 'need 2+ jobs in search');
  }

  const kycGet = await workerFetch(base, '/profile/kyc', { bearer: token });
  assert(kycGet.ok, 'GET /api/worker/profile/kyc (recheck)', `${kycGet.status}`);

  if (kycGet.data?.status !== 'VERIFIED' && kycGet.data?.status !== 'PENDING') {
    const kycPost = await workerFetch(base, '/profile/kyc', {
      method: 'POST',
      bearer: token,
      body: {
        documentType: 'NATIONAL_ID',
        frontIdImageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        backIdImageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      },
    });
    assert(
      kycPost.ok || kycPost.status === 400,
      'POST /api/worker/profile/kyc',
      `${kycPost.status} ${JSON.stringify(kycPost.data)}`,
    );
  } else {
    skip('POST /api/worker/profile/kyc', `already ${kycGet.data?.status}`);
  }

  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const form = new FormData();
  form.append(
    'file',
    new Blob([png], { type: 'image/png' }),
    'avatar.png',
  );

  const avatarUrl = `${base.replace(/\/$/, '')}/api/worker/profile/avatar`;
  const avatarRes = await fetch(avatarUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const avatarText = await avatarRes.text();
  let avatarData;
  try {
    avatarData = JSON.parse(avatarText);
  } catch {
    avatarData = avatarText;
  }
  assert(
    avatarRes.ok,
    'POST /api/worker/profile/avatar',
    `${avatarRes.status} ${JSON.stringify(avatarData)}`,
  );

  const apps = await apiFetch(base, '/api/applications?limit=5', { bearer: token });
  assert(
    apps.ok && Array.isArray(apps.data?.items),
    'GET /api/applications (recheck)',
    `${apps.status} count=${apps.data?.items?.length ?? 0}`,
  );
}

async function main() {
  const base =
    process.env.API_URL?.trim() ||
    `http://127.0.0.1:${process.env.PORT ?? '8000'}`;

  const identifier =
    process.env.JOBALLA_WORKER_IDENTIFIER?.trim() ||
    process.env.SEED_WORKER_EMAIL?.trim() ||
    'fabricemokfembam@gmail.com';
  const password =
    process.env.JOBALLA_WORKER_PASSWORD?.trim() ||
    process.env.SEED_PASSWORD?.trim() ||
    'Thiago+123';

  const login = await fetchJson(base, '/auth/login', {
    method: 'POST',
    body: { identifier, password },
  });
  if (!login.ok || !login.data?.accessToken) {
    throw new Error(`Worker login failed: ${login.status}`);
  }

  await runExtraWorkerTests(base, login.data.accessToken);
  await teardown();
  process.exit(exitCode());
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
