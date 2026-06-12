#!/usr/bin/env node
/**
 * Admin portal — Jobs moderation (9 routes)
 */
import { initAdminPortalEnv } from './lib/init.mjs';
import { assert, exitCode, skip } from './lib/assert.mjs';
import { adminFetch } from './lib/http.mjs';
import { isRemoteApi } from './lib/config.mjs';
import { getPrisma } from './lib/prisma.mjs';
import {
  bootstrapAdminTestState,
  loadStateFromEnv,
  teardown,
} from './lib/bootstrap.mjs';

initAdminPortalEnv();

/**
 * @param {import('./lib/bootstrap.mjs').AdminTestState} state
 */
export async function runJobsTests(state) {
  console.log('\n=== Jobs ===\n');

  const list = await adminFetch(
    state.base,
    '/jobs?moderationQueue=true&limit=10',
    { bearer: state.token },
  );
  assert(
    list.ok && list.data?.items !== undefined,
    'GET /admin/jobs',
    `${list.status} ${JSON.stringify(list.data)}`,
  );

  const jobId =
    state.jobId ??
    list.data.items.find((i) => i.status === 'pending_review')?.id ??
    list.data.items[0]?.id;

  if (!jobId) {
    skip('Job detail/mutations', 'no jobId');
    return state;
  }

  const detail = await adminFetch(state.base, `/jobs/${jobId}`, {
    bearer: state.token,
  });
  assert(
    detail.ok && detail.data?.id === jobId,
    'GET /admin/jobs/:jobId',
    `${detail.status} ${JSON.stringify(detail.data)}`,
  );

  const note = await adminFetch(state.base, `/jobs/${jobId}/notes`, {
    method: 'POST',
    bearer: state.token,
    body: { note: 'Moderation note from smoke test.' },
  });
  assert(note.ok, 'POST /admin/jobs/:jobId/notes', `${note.status}`);

  const audit = await adminFetch(state.base, `/jobs/${jobId}/audit-log`, {
    bearer: state.token,
  });
  assert(audit.ok, 'GET /admin/jobs/:jobId/audit-log', `${audit.status}`);

  const approve = await adminFetch(state.base, `/jobs/${jobId}/approve`, {
    method: 'POST',
    bearer: state.token,
    body: { note: 'Job approved in smoke test.' },
  });
  assert(
    approve.ok &&
      (approve.data?.status === 'published' || approve.data?.status === 'approved'),
    'POST /admin/jobs/:jobId/approve',
    `${approve.status} ${JSON.stringify(approve.data)}`,
  );

  const suspend = await adminFetch(state.base, `/jobs/${jobId}/suspend`, {
    method: 'POST',
    bearer: state.token,
  });
  assert(
    suspend.ok && suspend.data?.status === 'suspended',
    'POST /admin/jobs/:jobId/suspend',
    `${suspend.status} ${JSON.stringify(suspend.data)}`,
  );

  const restore = await adminFetch(state.base, `/jobs/${jobId}/restore`, {
    method: 'POST',
    bearer: state.token,
  });
  assert(
    restore.ok &&
      (restore.data?.status === 'published' || restore.data?.status === 'approved'),
    'POST /admin/jobs/:jobId/restore',
    `${restore.status} ${JSON.stringify(restore.data)}`,
  );

  if (state.role !== 'super_admin') {
    skip('DELETE /admin/jobs/:jobId', 'super_admin only');
  } else if (isRemoteApi(state.base) && process.env.JOBALLA_ADMIN_BOOTSTRAP !== '1') {
    skip(
      'DELETE /admin/jobs/:jobId',
      'remote API — set JOBALLA_ADMIN_BOOTSTRAP=1 with DATABASE_URL to seed a draft job',
    );
  } else {
    try {
      const prisma = getPrisma();
      let employer = null;
      if (state.employerUserId) {
        employer = await prisma.employerProfile.findFirst({
          where: { userId: state.employerUserId },
        });
      }
      if (!employer && jobId) {
        const jobRow = await prisma.job.findUnique({ where: { id: jobId } });
        if (jobRow) {
          employer = await prisma.employerProfile.findUnique({
            where: { id: jobRow.employerId },
          });
        }
      }
      if (employer) {
        const draft = await prisma.job.create({
          data: {
            employerId: employer.id,
            title: `Draft delete test ${Date.now()}`,
            description: 'Draft for admin DELETE smoke test.',
            category: 'Test',
            jobType: 'CASUAL',
            location: 'Douala',
            payRate: 1000,
            payStructure: 'HOURLY',
            requiredSkills: [],
            requestedDocuments: [],
            status: 'DRAFT',
          },
        });
        const del = await adminFetch(state.base, `/jobs/${draft.id}`, {
          method: 'DELETE',
          bearer: state.token,
        });
        assert(
          del.ok && del.data?.deleted === true,
          'DELETE /admin/jobs/:jobId',
          `${del.status} ${JSON.stringify(del.data)}`,
        );
      } else {
        skip('DELETE /admin/jobs/:jobId', 'no employer profile for draft job');
      }
    } catch (err) {
      skip(
        'DELETE /admin/jobs/:jobId',
        `Prisma unavailable (${err instanceof Error ? err.message : err})`,
      );
    }
  }

  state.jobId = jobId;
  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) state = await bootstrapAdminTestState();
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
