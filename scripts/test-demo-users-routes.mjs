#!/usr/bin/env node
/**
 * Re-test routes that were skipped or had issues, using Fabrice demo accounts.
 *
 *   npm run test:demo-routes
 *   JOBALLA_DEMO_USE_LOCAL=1 API_URL=http://127.0.0.1:8000 npm run test:demo-routes
 */
import { loadRootDotenvOptional } from './lib/dotenv-lite.mjs';
import { fetchJson } from './lib/fetch-json.mjs';
import { resetFailed, exitCode, assert, skip, fail } from './worker-portal/lib/assert.mjs';
import { runExtraWorkerTests } from './worker-portal/08-extra-routes.mjs';
import { employerFetch } from './employer-portal/lib/http.mjs';
import { sampleJobBody } from './employer-portal/lib/bootstrap.mjs';
import { apiFetch } from './worker-portal/lib/http.mjs';
import { teardown } from './worker-portal/lib/bootstrap.mjs';

loadRootDotenvOptional();

const base = (
  process.env.API_URL?.trim() ||
  (process.env.JOBALLA_DEMO_USE_LOCAL === '1'
    ? `http://127.0.0.1:${process.env.PORT ?? '8000'}`
    : 'https://joballa-api.onrender.com')
).replace(/\/$/, '');

const WORKER_EMAIL =
  process.env.SEED_WORKER_EMAIL?.trim() || 'fabricemokfembam@gmail.com';
const EMPLOYER_EMAIL =
  process.env.SEED_EMPLOYER_EMAIL?.trim() || 'fabricekongnyuy2@gmail.com';
const PASSWORD = process.env.SEED_PASSWORD?.trim() || 'Thiago+123';

async function login(identifier) {
  const res = await fetchJson(base, '/auth/login', {
    method: 'POST',
    body: { identifier, password: PASSWORD },
  });
  if (!res.ok || !res.data?.accessToken) {
    throw new Error(
      `Login failed ${identifier}: ${res.status} ${JSON.stringify(res.data)}`,
    );
  }
  return res.data.accessToken;
}

async function testEmployerMissedRoutes(employerToken, workerToken) {
  console.log('\n=== Employer — extra / workforce / engagements ===\n');

  const me = await employerFetch(base, '/me', { bearer: employerToken });
  assert(me.ok && me.data?.company?.id, 'GET /api/employer/me', `${me.status}`);

  const workerMe = await fetchJson(base, '/api/worker/me', {
    bearer: workerToken,
  });
  const workerProfileId = workerMe.data?.workerProfile?.id;
  if (!workerProfileId) {
    skip('employer workforce', 'no worker profile id');
    return;
  }

  const workforce = await employerFetch(base, '/workforce?status=all', {
    bearer: employerToken,
  });
  assert(
    workforce.ok && Array.isArray(workforce.data?.items),
    'GET /api/employer/workforce',
    `${workforce.status} items=${workforce.data?.items?.length ?? 0}`,
  );

  const one = await employerFetch(base, `/workforce/${workerProfileId}`, {
    bearer: employerToken,
  });
  assert(
    one.ok,
    'GET /api/employer/workforce/:workerId',
    `${one.status}`,
  );

  const shift = await employerFetch(
    base,
    `/workforce/${workerProfileId}/shifts`,
    {
      method: 'POST',
      bearer: employerToken,
      body: {
        date: new Date().toISOString().slice(0, 10),
        hours: 6,
        notes: 'Demo re-test shift',
      },
    },
  );
  assert(
    shift.ok && shift.data?.shiftId,
    'POST /api/employer/workforce/:workerId/shifts',
    `${shift.status}`,
  );

  const engList = await fetchJson(base, '/api/employer/engagements?limit=10', {
    bearer: employerToken,
  });
  if (engList.status === 404) {
    skip('GET /api/employer/engagements', 'route uses workforce not legacy list');
  } else {
    assert(
      engList.ok,
      'GET /api/employer/engagements',
      `${engList.status}`,
    );
  }

  const applicants = await employerFetch(base, '/applicants?limit=10', {
    bearer: employerToken,
  });
  assert(
    applicants.ok && Array.isArray(applicants.data?.items),
    'GET /api/employer/applicants (recheck)',
    `${applicants.status} count=${applicants.data?.items?.length ?? 0}`,
  );

  const create = await employerFetch(base, '/jobs', {
    method: 'POST',
    bearer: employerToken,
    body: sampleJobBody({
      title: `Re-test job ${Date.now()}`,
      city: 'Douala',
    }),
  });
  assert(
    create.ok && (create.data?.jobId ?? create.data?.id),
    'POST /api/employer/jobs (employer portal DTO)',
    `${create.status}`,
  );

  const newJobId = create.data?.jobId ?? create.data?.id;
  if (newJobId) {
    const live = await employerFetch(base, `/jobs/${newJobId}/status`, {
      method: 'PATCH',
      bearer: employerToken,
      body: { status: 'live' },
    });
    assert(live.ok, 'PATCH /api/employer/jobs/:jobId/status → live', `${live.status}`);

    const customize = await apiFetch(
      base,
      `/api/jobs/${newJobId}/application/customize-profile`,
      {
        method: 'POST',
        bearer: workerToken,
        body: {
          professionalSummary: 'Re-test customization draft.',
          skills: ['Cleaning', 'Cooking'],
        },
      },
    );
    assert(
      customize.ok,
      'POST /api/jobs/:jobId/application/customize-profile (recheck)',
      `${customize.status}`,
    );

    const apply = await apiFetch(base, `/api/jobs/${newJobId}/apply`, {
      method: 'POST',
      bearer: workerToken,
      body: { jobSpecificNote: 'Re-test apply after customize.' },
    });
    assert(
      apply.ok || apply.status === 409,
      'POST /api/jobs/:jobId/apply (recheck)',
      `${apply.status} ${JSON.stringify(apply.data)}`,
    );
  }
}

async function main() {
  console.log('Demo user route re-tests');
  console.log(`Base: ${base}`);
  console.log(`Worker: ${WORKER_EMAIL}`);
  console.log(`Employer: ${EMPLOYER_EMAIL}\n`);

  resetFailed();

  const workerToken = await login(WORKER_EMAIL);
  const employerToken = await login(EMPLOYER_EMAIL);
  console.log('OK   — logins');

  await runExtraWorkerTests(base, workerToken);
  await testEmployerMissedRoutes(employerToken, workerToken);
  await teardown();

  console.log('');
  if (exitCode() === 0) {
    console.log('All re-tests passed (or acceptable skips).');
  } else {
    console.error('Some re-tests failed.');
  }
  process.exit(exitCode());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
