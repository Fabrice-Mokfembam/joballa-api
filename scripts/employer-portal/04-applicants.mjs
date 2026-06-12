#!/usr/bin/env node
/**
 * Employer portal — Applicants (5 routes)
 *   GET   /api/employer/applicants
 *   GET   /api/employer/applicants/filters
 *   GET   /api/employer/applicants/:applicationId
 *   PATCH /api/employer/applicants/:applicationId/status
 *   GET   /api/employer/applicants/:applicationId/share
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

/**
 * @param {import('./lib/bootstrap.mjs').EmployerTestState} state
 */
export async function runApplicantsTests(state) {
  console.log('\n=== Applicants ===\n');

  if (!state.applicationId) {
    console.warn(
      'SKIP — no applicationId (bootstrap with seed or set JOBALLA_TEST_APPLICATION_ID)',
    );
    return state;
  }

  const filters = await employerFetch(state.base, '/applicants/filters', {
    bearer: state.employerToken,
  });
  assert(
    filters.ok && Array.isArray(filters.data?.jobTitles),
    'GET /api/employer/applicants/filters',
    `${filters.status} ${JSON.stringify(filters.data)}`,
  );

  const list = await employerFetch(
    state.base,
    '/applicants?status=pending&page=1&limit=10',
    { bearer: state.employerToken },
  );
  assert(
    list.ok && Array.isArray(list.data?.items),
    'GET /api/employer/applicants',
    `${list.status} ${JSON.stringify(list.data)}`,
  );

  const detail = await employerFetch(
    state.base,
    `/applicants/${state.applicationId}`,
    { bearer: state.employerToken },
  );
  assert(
    detail.ok &&
      detail.data?.applicationId === state.applicationId &&
      detail.data?.submittedProfile,
    'GET /api/employer/applicants/:applicationId',
    `${detail.status} ${JSON.stringify(detail.data)}`,
  );

  const share = await employerFetch(
    state.base,
    `/applicants/${state.applicationId}/share`,
    { bearer: state.employerToken },
  );
  assert(
    share.ok && typeof share.data?.shareUrl === 'string',
    'GET /api/employer/applicants/:applicationId/share',
    `${share.status} ${JSON.stringify(share.data)}`,
  );

  const shortlist = await employerFetch(
    state.base,
    `/applicants/${state.applicationId}/status`,
    {
      method: 'PATCH',
      bearer: state.employerToken,
      body: { status: 'shortlisted' },
    },
  );
  assert(
    shortlist.ok && shortlist.data?.status === 'shortlisted',
    'PATCH /api/employer/applicants/:applicationId/status (shortlisted)',
    `${shortlist.status} ${JSON.stringify(shortlist.data)}`,
  );

  const hired = await employerFetch(
    state.base,
    `/applicants/${state.applicationId}/status`,
    {
      method: 'PATCH',
      bearer: state.employerToken,
      body: { status: 'hired' },
    },
  );
  assert(
    hired.ok && hired.data?.status === 'hired',
    'PATCH /api/employer/applicants/:applicationId/status (hired)',
    `${hired.status} ${JSON.stringify(hired.data)}`,
  );

  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    state = await bootstrapEmployerTestState({ seedApplication: true });
  }
  await runApplicantsTests(state);
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
