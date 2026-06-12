#!/usr/bin/env node
/**
 * Smoke tests for May 2026 worker route additions:
 *   PUT /api/worker/profile
 *   GET /api/worker/dashboard
 *   GET /api/worker/jobs, /applications
 *   GET /api/worker/notifications
 *   GET /api/earnings/transactions/:id
 *   POST /files/verification-doc
 *   Job card fields on GET /api/jobs
 */
import { initWorkerPortalEnv } from './lib/init.mjs';
import { assert, exitCode, skip } from './lib/assert.mjs';
import { apiFetch, workerFetch } from './lib/http.mjs';
import {
  bootstrapWorkerTestState,
  loadStateFromEnv,
  teardown,
} from './lib/bootstrap.mjs';
import { loadLocalDevToken } from './lib/local-token.mjs';
import { isMain } from './lib/is-main.mjs';

initWorkerPortalEnv();

/**
 * @param {import('./lib/bootstrap.mjs').WorkerTestState} state
 */
export async function runMay2026RouteTests(state) {
  console.log('\n=== May 2026 — new / updated worker routes ===\n');

  const me = await workerFetch(state.base, '/me', { bearer: state.workerToken });
  assert(
    me.ok && me.data?.workerProfile?.profileStrengthBreakdown,
    'GET /api/worker/me — profileStrengthBreakdown',
    `${me.status} keys=${Object.keys(me.data?.workerProfile?.profileStrengthBreakdown ?? {}).join(',')}`,
  );
  assert(
    typeof me.data?.workerProfile?.profileViews === 'number',
    'GET /api/worker/me — profileViews',
    String(me.data?.workerProfile?.profileViews),
  );

  const profile = await workerFetch(state.base, '/profile', {
    bearer: state.workerToken,
  });
  assert(
    profile.ok &&
      profile.data?.summary !== undefined &&
      Array.isArray(profile.data?.workHistories) &&
      Array.isArray(profile.data?.paymentAccounts),
    'GET /api/worker/profile — WorkerFullProfile shape',
    `${profile.status} hasSummary=${!!profile.data?.summary}`,
  );

  const put = await workerFetch(state.base, '/profile', {
    method: 'PUT',
    bearer: state.workerToken,
    body: {
      city: profile.data?.city ?? 'Buea',
      skills: profile.data?.skills?.length
        ? profile.data.skills
        : ['smoke-test'],
      professionalTitle:
        profile.data?.professionalTitle ?? 'Smoke Test Worker',
      summary: profile.data?.summary ?? 'Updated via PUT smoke test.',
    },
  });
  assert(
    put.ok && put.data?.id === state.workerProfileId && put.data?.skills,
    'PUT /api/worker/profile',
    `${put.status} completeness=${put.data?.profileCompleteness}`,
  );

  const dash = await workerFetch(state.base, '/dashboard', {
    bearer: state.workerToken,
  });
  assert(
    dash.ok &&
      dash.data?.greeting?.name &&
      dash.data?.stats &&
      Array.isArray(dash.data?.recommendedJobs),
    'GET /api/worker/dashboard',
    `${dash.status} apps=${dash.data?.applications?.length ?? 0}`,
  );

  const myJobs = await workerFetch(state.base, '/jobs?page=1&limit=5', {
    bearer: state.workerToken,
  });
  assert(
    myJobs.ok && Array.isArray(myJobs.data?.items),
    'GET /api/worker/jobs',
    `${myJobs.status} total=${myJobs.data?.total}`,
  );

  const incoming = await workerFetch(
    state.base,
    '/jobs/applications?page=1&limit=5',
    { bearer: state.workerToken },
  );
  assert(
    incoming.ok && Array.isArray(incoming.data?.items),
    'GET /api/worker/jobs/applications',
    `${incoming.status} total=${incoming.data?.total}`,
  );

  const notifs = await workerFetch(
    state.base,
    '/notifications?page=1&limit=10',
    { bearer: state.workerToken },
  );
  assert(
    notifs.ok && Array.isArray(notifs.data?.items),
    'GET /api/worker/notifications',
    `${notifs.status} total=${notifs.data?.total}`,
  );

  const settings = await workerFetch(state.base, '/settings/notifications', {
    method: 'PATCH',
    bearer: state.workerToken,
    body: { pushEnabled: true, jobsEnabled: true },
  });
  assert(
    settings.ok && settings.data?.pushEnabled === true,
    'PATCH /api/worker/settings/notifications',
    `${settings.status} ${JSON.stringify(settings.data)}`,
  );

  const payAccounts = await workerFetch(
    state.base,
    '/profile/payment-accounts',
    { bearer: state.workerToken },
  );
  assert(
    payAccounts.ok && Array.isArray(payAccounts.data?.items),
    'GET /api/worker/profile/payment-accounts',
    `${payAccounts.status}`,
  );

  const jobs = await apiFetch(state.base, '/api/jobs?page=1&limit=3', {
    bearer: state.workerToken,
  });
  const first = jobs.data?.items?.[0];
  assert(
    jobs.ok &&
      first &&
      'slug' in first &&
      'companyName' in first &&
      'hasApplied' in first &&
      'saved' in first,
    'GET /api/jobs — normalized job card',
    first
      ? `slug=${first.slug} hasApplied=${first.hasApplied}`
      : `${jobs.status} empty`,
  );

  const tx = await apiFetch(
    state.base,
    '/api/earnings/transactions?page=1&limit=1',
    { bearer: state.workerToken },
  );
  const txId = tx.data?.items?.[0]?.id;
  if (txId) {
    const one = await apiFetch(
      state.base,
      `/api/earnings/transactions/${txId}`,
      { bearer: state.workerToken },
    );
    assert(
      one.ok && one.data?.id === txId,
      'GET /api/earnings/transactions/:transactionId',
      `${one.status}`,
    );
  } else {
    skip(
      'GET /api/earnings/transactions/:transactionId',
      'no transactions for worker',
    );
  }

  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'kyc.png');
  const verifyUrl = `${state.base.replace(/\/$/, '')}/files/verification-doc`;
  const verifyRes = await fetch(verifyUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${state.workerToken}` },
    body: form,
  });
  const verifyText = await verifyRes.text();
  let verifyData;
  try {
    verifyData = JSON.parse(verifyText);
  } catch {
    verifyData = verifyText;
  }
  assert(
    verifyRes.ok && (verifyData?.url || verifyData?.secureUrl),
    'POST /files/verification-doc',
    `${verifyRes.status} ${JSON.stringify(verifyData)}`,
  );

  const kycVerified = await workerFetch(state.base, '/profile/kyc', {
    bearer: state.workerToken,
  });
  if (kycVerified.data?.status !== 'VERIFIED') {
    skip(
      'POST /api/worker/jobs (KYC gate)',
      `worker KYC is ${kycVerified.data?.status ?? 'none'}`,
    );
  } else {
    const createJob = await workerFetch(state.base, '/jobs', {
      method: 'POST',
      bearer: state.workerToken,
      body: {
        title: `Smoke job ${Date.now()}`,
        city: 'Douala',
        description: 'Created by May 2026 smoke test.',
        jobType: 'PART_TIME',
        payRate: 50000,
        payStructure: 'MONTHLY',
        asDraft: true,
      },
    });
    assert(
      createJob.ok || createJob.status === 400,
      'POST /api/worker/jobs',
      `${createJob.status} ${JSON.stringify(createJob.data)}`,
    );
  }
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    state = await loadLocalDevToken();
    if (state) {
      console.log(
        'Using locally minted JWT (DATABASE_URL + JWT_SECRET). /auth/login not used.\n',
      );
    }
  }
  if (!state) {
    state = await bootstrapWorkerTestState({ seedEngagement: false });
  }
  await runMay2026RouteTests(state);
  await teardown();
  process.exit(exitCode());
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
