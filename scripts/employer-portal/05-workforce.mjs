#!/usr/bin/env node
/**
 * Employer portal — Workforce (7 routes)
 *   GET    /api/employer/workforce
 *   GET    /api/employer/workforce/:workerId
 *   GET    /api/employer/workforce/:workerId/shifts
 *   POST   /api/employer/workforce/:workerId/shifts
 *   PATCH  /api/employer/workforce/:workerId/shifts/:shiftId
 *   DELETE /api/employer/workforce/:workerId/shifts/:shiftId
 *   PATCH  /api/employer/workforce/:workerId/status
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
export async function runWorkforceTests(state) {
  console.log('\n=== Workforce ===\n');

  if (!state.workerProfileId) {
    console.warn('SKIP — no workerProfileId (run applicants hire step or set env)');
    return state;
  }

  const list = await employerFetch(state.base, '/workforce?status=all', {
    bearer: state.employerToken,
  });
  assert(
    list.ok && list.data?.activeWorkers && Array.isArray(list.data?.items),
    'GET /api/employer/workforce',
    `${list.status} ${JSON.stringify(list.data)}`,
  );

  const worker = await employerFetch(
    state.base,
    `/workforce/${state.workerProfileId}`,
    { bearer: state.employerToken },
  );
  assert(
    worker.ok && worker.data?.worker?.workerId === state.workerProfileId,
    'GET /api/employer/workforce/:workerId',
    `${worker.status} ${JSON.stringify(worker.data)}`,
  );

  const shiftDate = new Date().toISOString().slice(0, 10);
  const createShift = await employerFetch(
    state.base,
    `/workforce/${state.workerProfileId}/shifts`,
    {
      method: 'POST',
      bearer: state.employerToken,
      body: {
        date: shiftDate,
        hours: 8,
        notes: 'Employer portal test shift',
      },
    },
  );
  assert(
    createShift.ok && createShift.data?.shiftId,
    'POST /api/employer/workforce/:workerId/shifts',
    `${createShift.status} ${JSON.stringify(createShift.data)}`,
  );
  state.shiftId = createShift.data.shiftId;

  const shifts = await employerFetch(
    state.base,
    `/workforce/${state.workerProfileId}/shifts?page=1&limit=20`,
    { bearer: state.employerToken },
  );
  assert(
    shifts.ok && Array.isArray(shifts.data?.items),
    'GET /api/employer/workforce/:workerId/shifts',
    `${shifts.status} ${JSON.stringify(shifts.data)}`,
  );

  const patchShift = await employerFetch(
    state.base,
    `/workforce/${state.workerProfileId}/shifts/${state.shiftId}`,
    {
      method: 'PATCH',
      bearer: state.employerToken,
      body: { hours: 7, notes: 'Updated shift notes' },
    },
  );
  assert(
    patchShift.ok && patchShift.data?.hours === 7,
    'PATCH /api/employer/workforce/:workerId/shifts/:shiftId',
    `${patchShift.status} ${JSON.stringify(patchShift.data)}`,
  );

  const delShift = await employerFetch(
    state.base,
    `/workforce/${state.workerProfileId}/shifts/${state.shiftId}`,
    {
      method: 'DELETE',
      bearer: state.employerToken,
    },
  );
  assert(
    delShift.status === 204 || delShift.ok,
    'DELETE /api/employer/workforce/:workerId/shifts/:shiftId',
    `${delShift.status}`,
  );

  const status = await employerFetch(
    state.base,
    `/workforce/${state.workerProfileId}/status`,
    {
      method: 'PATCH',
      bearer: state.employerToken,
      body: { status: 'active', reason: 'Reinstated for test' },
    },
  );
  assert(
    status.ok && status.data?.status,
    'PATCH /api/employer/workforce/:workerId/status',
    `${status.status} ${JSON.stringify(status.data)}`,
  );

  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    state = await bootstrapEmployerTestState({ seedApplication: true });
  }
  const { runApplicantsTests } = await import('./04-applicants.mjs');
  await runApplicantsTests(state);
  await runWorkforceTests(state);
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
