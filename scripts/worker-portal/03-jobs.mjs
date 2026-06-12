#!/usr/bin/env node
/**
 * Worker portal — Job discovery (8 routes under /api/jobs)
 */
import { initWorkerPortalEnv } from './lib/init.mjs';
import { assert, exitCode, skip } from './lib/assert.mjs';
import { apiFetch } from './lib/http.mjs';
import {
  bootstrapWorkerTestState,
  loadStateFromEnv,
  teardown,
} from './lib/bootstrap.mjs';
import { isMain } from './lib/is-main.mjs';

initWorkerPortalEnv();

/**
 * @param {import('./lib/bootstrap.mjs').WorkerTestState} state
 */
export async function runJobsTests(state) {
  console.log('\n=== Jobs (browse, save, hide, report) ===\n');

  const search = await apiFetch(state.base, '/api/jobs?page=1&limit=5', {
    bearer: state.workerToken,
  });
  assert(
    search.ok && Array.isArray(search.data?.items),
    'GET /api/jobs',
    `${search.status} ${JSON.stringify(search.data)}`,
  );

  const emptyFilters = await apiFetch(
    state.base,
    '/api/jobs?keyword=&city=&category=all&page=1&limit=5',
    { bearer: state.workerToken },
  );
  assert(
    emptyFilters.ok &&
      (emptyFilters.data?.total ?? 0) > 0 &&
      (emptyFilters.data?.items?.length ?? 0) > 0,
    'GET /api/jobs ignores empty/placeholder filters',
    `${emptyFilters.status} total=${emptyFilters.data?.total}`,
  );

  const strict = await apiFetch(
    state.base,
    '/api/jobs?workMode=REMOTE&jobType=FULL_TIME&keyword=zzzz-no-match&page=1&limit=5',
    { bearer: state.workerToken },
  );
  const baseTotal = search.data?.total ?? 0;
  if (baseTotal > 0) {
    assert(
      strict.ok &&
        (strict.data?.total ?? 0) > 0 &&
        strict.data?.relaxedFilters === true,
      'GET /api/jobs falls back to general feed when filters match nothing',
      `${strict.status} total=${strict.data?.total} relaxed=${strict.data?.relaxedFilters}`,
    );
  } else {
    skip('jobs filter fallback', 'no ACTIVE jobs in DB to test fallback');
  }

  if (!state.jobId) {
    skip('job detail/save/hide/report', 'no JOBALLA_TEST_JOB_ID or bootstrap job');
    return state;
  }

  const detail = await apiFetch(state.base, `/api/jobs/${state.jobId}`, {
    bearer: state.workerToken,
  });
  assert(
    detail.ok && detail.data?.id === state.jobId,
    'GET /api/jobs/:jobId',
    `${detail.status} ${JSON.stringify(detail.data)}`,
  );

  const save = await apiFetch(state.base, `/api/jobs/${state.jobId}/save`, {
    method: 'POST',
    bearer: state.workerToken,
  });
  assert(
    save.ok,
    'POST /api/jobs/:jobId/save',
    `${save.status} ${JSON.stringify(save.data)}`,
  );

  const share = await apiFetch(state.base, `/api/jobs/${state.jobId}/share`, {
    bearer: state.workerToken,
  });
  assert(
    share.ok && share.data?.url,
    'GET /api/jobs/:jobId/share',
    `${share.status} ${JSON.stringify(share.data)}`,
  );

  const hide = await apiFetch(state.base, `/api/jobs/${state.jobId}/hide`, {
    method: 'POST',
    bearer: state.workerToken,
  });
  assert(
    hide.ok,
    'POST /api/jobs/:jobId/hide',
    `${hide.status} ${JSON.stringify(hide.data)}`,
  );

  const unhide = await apiFetch(state.base, `/api/jobs/${state.jobId}/hide`, {
    method: 'DELETE',
    bearer: state.workerToken,
  });
  assert(
    unhide.ok || unhide.status === 204,
    'DELETE /api/jobs/:jobId/hide',
    `${unhide.status}`,
  );

  const report = await apiFetch(state.base, `/api/jobs/${state.jobId}/report`, {
    method: 'POST',
    bearer: state.workerToken,
    body: { reason: 'OTHER', description: 'Worker portal smoke report' },
  });
  assert(
    report.ok || report.status === 409,
    'POST /api/jobs/:jobId/report',
    `${report.status} ${JSON.stringify(report.data)}`,
  );

  const unsave = await apiFetch(state.base, `/api/jobs/${state.jobId}/save`, {
    method: 'DELETE',
    bearer: state.workerToken,
  });
  assert(
    unsave.ok || unsave.status === 204,
    'DELETE /api/jobs/:jobId/save',
    `${unsave.status}`,
  );

  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    state = await bootstrapWorkerTestState();
  }
  await runJobsTests(state);
  await teardown();
  process.exit(exitCode());
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
