#!/usr/bin/env node
/**
 * Employer portal — Jobs (7 routes)
 *   POST   /api/employer/jobs
 *   GET    /api/employer/jobs
 *   GET    /api/employer/jobs/:jobId
 *   PATCH  /api/employer/jobs/:jobId
 *   PATCH  /api/employer/jobs/:jobId/status
 *   POST   /api/employer/jobs/:jobId/draft
 *   DELETE /api/employer/jobs/:jobId
 */
import { initEmployerPortalEnv } from './lib/init.mjs';
import { assert, exitCode } from './lib/assert.mjs';
import { employerFetch } from './lib/http.mjs';
import {
  bootstrapEmployerTestState,
  loadStateFromEnv,
  sampleJobBody,
  teardown,
} from './lib/bootstrap.mjs';

initEmployerPortalEnv();

/**
 * @param {import('./lib/bootstrap.mjs').EmployerTestState} state
 */
export async function runJobsTests(state) {
  console.log('\n=== Jobs ===\n');

  const create = await employerFetch(state.base, '/jobs', {
    method: 'POST',
    bearer: state.employerToken,
    body: sampleJobBody({ title: `Test Job ${Date.now()}` }),
  });
  assert(
    create.ok && create.data?.jobId && create.data?.status,
    'POST /api/employer/jobs',
    `${create.status} ${JSON.stringify(create.data)}`,
  );
  const jobId = create.data.jobId;

  const draftCreate = await employerFetch(state.base, '/jobs', {
    method: 'POST',
    bearer: state.employerToken,
    body: { ...sampleJobBody({ title: 'Draft Job' }), asDraft: true },
  });
  assert(
    draftCreate.ok && draftCreate.data?.status === 'draft',
    'POST /api/employer/jobs (asDraft)',
    `${draftCreate.status} ${JSON.stringify(draftCreate.data)}`,
  );
  const draftJobId = draftCreate.data.jobId;

  const list = await employerFetch(state.base, '/jobs?status=pending_review&page=1&limit=10', {
    bearer: state.employerToken,
  });
  assert(
    list.ok && Array.isArray(list.data?.items),
    'GET /api/employer/jobs',
    `${list.status} ${JSON.stringify(list.data)}`,
  );

  const one = await employerFetch(state.base, `/jobs/${jobId}`, {
    bearer: state.employerToken,
  });
  assert(
    one.ok && one.data?.jobId === jobId,
    'GET /api/employer/jobs/:jobId',
    `${one.status} ${JSON.stringify(one.data)}`,
  );

  const patch = await employerFetch(state.base, `/jobs/${draftJobId}`, {
    method: 'PATCH',
    bearer: state.employerToken,
    body: { description: 'Updated draft description for employer portal tests.' },
  });
  assert(
    patch.ok && patch.data?.jobId === draftJobId,
    'PATCH /api/employer/jobs/:jobId',
    `${patch.status} ${JSON.stringify(patch.data)}`,
  );

  const saveDraft = await employerFetch(state.base, `/jobs/${draftJobId}/draft`, {
    method: 'POST',
    bearer: state.employerToken,
    body: { city: 'Douala', neighbourhood: 'Akwa' },
  });
  assert(
    saveDraft.ok && saveDraft.data?.status === 'draft',
    'POST /api/employer/jobs/:jobId/draft',
    `${saveDraft.status} ${JSON.stringify(saveDraft.data)}`,
  );

  const del = await employerFetch(state.base, `/jobs/${draftJobId}`, {
    method: 'DELETE',
    bearer: state.employerToken,
  });
  assert(
    del.status === 204 || del.ok,
    'DELETE /api/employer/jobs/:jobId',
    `${del.status} ${JSON.stringify(del.data)}`,
  );

  const statusPatch = await employerFetch(state.base, `/jobs/${jobId}/status`, {
    method: 'PATCH',
    bearer: state.employerToken,
    body: { status: 'closed' },
  });
  assert(
    statusPatch.ok && statusPatch.data?.status === 'closed',
    'PATCH /api/employer/jobs/:jobId/status',
    `${statusPatch.status} ${JSON.stringify(statusPatch.data)}`,
  );

  state.jobId = jobId;
  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    state = await bootstrapEmployerTestState({ seedApplication: false });
  }
  await runJobsTests(state);
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
