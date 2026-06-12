#!/usr/bin/env node
/**
 * Worker portal — Applications (5 routes)
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
export async function runApplicationsTests(state) {
  console.log('\n=== Applications ===\n');

  if (!state.jobId) {
    skip('applications', 'no jobId');
    return state;
  }

  const customize = await apiFetch(
    state.base,
    `/api/jobs/${state.jobId}/application/customize-profile`,
    {
      method: 'POST',
      bearer: state.workerToken,
      body: {
        professionalSummary: 'Tailored summary for this job application.',
        skills: ['cleaning', 'cooking'],
      },
    },
  );
  assert(
    customize.ok,
    'POST /api/jobs/:jobId/application/customize-profile',
    `${customize.status} ${JSON.stringify(customize.data)}`,
  );

  const apply = await apiFetch(state.base, `/api/jobs/${state.jobId}/apply`, {
    method: 'POST',
    bearer: state.workerToken,
    body: { jobSpecificNote: 'Worker portal smoke application' },
  });
  if (apply.ok && apply.data?.id) {
    state.applicationId = apply.data.id;
    assert(true, 'POST /api/jobs/:jobId/apply', apply.data.id);
  } else if (apply.status === 409) {
    assert(true, 'POST /api/jobs/:jobId/apply', 'already applied (409 — OK for re-run)');
  } else {
    assert(false, 'POST /api/jobs/:jobId/apply', `${apply.status} ${JSON.stringify(apply.data)}`);
  }

  const list = await apiFetch(state.base, '/api/applications?page=1&limit=10', {
    bearer: state.workerToken,
  });
  assert(
    list.ok && Array.isArray(list.data?.items),
    'GET /api/applications',
    `${list.status} ${JSON.stringify(list.data)}`,
  );

  if (!state.applicationId && list.data?.items?.length) {
    const forJob = list.data.items.find(
      (a) => a.jobId === state.jobId || a.job?.id === state.jobId,
    );
    state.applicationId =
      forJob?.id ?? forJob?.applicationId ?? list.data.items[0]?.id;
  }

  const one = await apiFetch(
    state.base,
    `/api/applications/${state.applicationId}`,
    { bearer: state.workerToken },
  );
  assert(
    one.ok && one.data?.id === state.applicationId,
    'GET /api/applications/:applicationId',
    `${one.status} ${JSON.stringify(one.data)}`,
  );

  const archive = await apiFetch(
    state.base,
    `/api/applications/${state.applicationId}`,
    { method: 'DELETE', bearer: state.workerToken },
  );
  assert(
    archive.ok || archive.status === 204,
    'DELETE /api/applications/:applicationId (archive)',
    `${archive.status}`,
  );

  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    state = await bootstrapWorkerTestState();
  }
  await runApplicationsTests(state);
  await teardown();
  process.exit(exitCode());
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
