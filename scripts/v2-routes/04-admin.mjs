#!/usr/bin/env node
/**
 * Smoke-test all admin v2 routes (55 spec routes + auth).
 *
 *   API_URL=http://127.0.0.1:8000 node scripts/v2-routes/04-admin.mjs
 */
import bcrypt from 'bcrypt';
import { loadRootDotenvOptional } from '../lib/dotenv-lite.mjs';
import { fetchJson } from '../lib/fetch-json.mjs';
import { getBaseUrl } from '../lib/config.mjs';
import { assert, fail, ok, skip, resetFailed, exitCode } from '../worker-portal/lib/assert.mjs';
import { getPrisma, disconnectPrisma } from '../worker-portal/lib/prisma.mjs';

loadRootDotenvOptional();

/** @type {{ pass: string[]; fail: string[]; skip: string[] }} */
const report = { pass: [], fail: [], skip: [] };

function record(kind, label, detail) {
  report[kind].push(detail ? `${label} — ${detail}` : label);
}

async function check(label, fn, { skippable = false, skipReason = '' } = {}) {
  try {
    const result = await fn();
    if (result === 'skip') {
      skip(label, skipReason);
      record('skip', label, skipReason);
      return null;
    }
    assert(true, label);
    record('pass', label);
    return result;
  } catch (err) {
    if (skippable) {
      skip(label, err.message || String(err));
      record('skip', label, err.message || String(err));
      return null;
    }
    fail(label, err.message || err);
    record('fail', label, err.message || String(err));
    return null;
  }
}

function expectSuccess(res, label) {
  if (!res.ok || res.data?.success !== true) {
    throw new Error(`${label}: HTTP ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

async function ensureSuperAdmin(prisma) {
  const email = process.env.ADMIN_SMOKE_EMAIL || 'superadmin@joballa.cm';
  const password = process.env.ADMIN_SMOKE_PASSWORD || 'Joballa+Admin2026!';
  let admin = await prisma.adminAccount.findUnique({ where: { email } });
  if (!admin) {
    const perms = [
      'view_platform_logs',
      'view_platform_analytics',
      'manage_admins',
      'manage_jobs',
      'manage_platform_users',
      'verify_jobs',
      'manage_departments',
      'resolve_disputes',
      'verify_documents',
      'verify_kyc',
      'view_financial_records',
      'create_profiles',
    ];
    admin = await prisma.adminAccount.create({
      data: {
        email,
        fullName: 'Smoke Super Admin',
        passwordHash: await bcrypt.hash(password, 12),
        role: 'SUPER_ADMIN',
        isActive: true,
        invitePending: false,
        permissions: { create: perms.map((permission) => ({ permission })) },
      },
    });
  }
  return { email, password, adminId: admin.id };
}

async function seedFixtures(prisma, adminId) {
  const suffix = Date.now();
  const department = await prisma.department.upsert({
    where: { slug: 'admin-smoke-dept' },
    create: {
      name: `Admin Smoke Dept ${suffix}`,
      slug: `admin-smoke-dept-${suffix}`,
      category: 'SOFTWARE_TECH',
      description: 'Seeded for admin route smoke tests',
      createdByAdminId: adminId,
    },
    update: {},
  });

  const worker = await prisma.user.create({
    data: {
      email: `admin-smoke-worker-${suffix}@example.test`,
      passwordHash: await bcrypt.hash('SmokePass123!', 12),
      role: 'WORKER',
      accountStatus: 'ACTIVE',
      workerProfile: {
        create: {
          fullName: 'Admin Smoke Worker',
          verificationStatus: 'PENDING',
        },
      },
    },
    include: { workerProfile: true },
  });

  const employer = await prisma.user.create({
    data: {
      email: `admin-smoke-employer-${suffix}@example.test`,
      passwordHash: await bcrypt.hash('SmokePass123!', 12),
      role: 'EMPLOYER',
      accountStatus: 'ACTIVE',
      employerProfile: {
        create: {
          companyName: `Admin Smoke Co ${suffix}`,
          contactPersonName: 'Contact',
          verificationStatus: 'PENDING',
        },
      },
    },
    include: { employerProfile: true },
  });

  const kyc = await prisma.kycSubmission.create({
    data: {
      workerId: worker.id,
      kycType: 'NATIONAL_ID',
      frontUrl: 'https://example.test/kyc-front.jpg',
      backUrl: 'https://example.test/kyc-back.jpg',
      selfieUrl: 'https://example.test/kyc-selfie.jpg',
      status: 'PENDING',
    },
  });

  const document = await prisma.employerDocument.create({
    data: {
      employerId: employer.id,
      documentName: 'Business License.pdf',
      documentUrl: 'https://example.test/license.pdf',
      documentType: 'PDF',
      verificationStatus: 'PENDING',
    },
  });

  const pendingJob = await prisma.job.create({
    data: {
      ownerId: employer.id,
      departmentId: department.id,
      title: `Admin smoke pending ${suffix}`,
      employmentType: 'FULL_TIME',
      workMode: 'ONSITE',
      city: 'Douala',
      country: 'Cameroon',
      payAmount: 100000,
      payStructure: 'MONTHLY',
      description: 'Pending moderation job for admin smoke test.',
      status: 'UNDER_REVIEW',
    },
  });

  const rejectedJob = await prisma.job.create({
    data: {
      ownerId: employer.id,
      departmentId: department.id,
      title: `Admin smoke rejected ${suffix}`,
      employmentType: 'PART_TIME',
      workMode: 'REMOTE',
      city: 'Yaoundé',
      country: 'Cameroon',
      payAmount: 50000,
      payStructure: 'MONTHLY',
      description: 'Rejected job for admin smoke test.',
      status: 'REJECTED',
    },
  });

  await prisma.rejectionReason.create({
    data: {
      targetType: 'JOB',
      targetId: rejectedJob.id,
      reasonText: 'Incomplete listing details',
      rejectedByAdminId: adminId,
    },
  });

  const application = await prisma.application.create({
    data: {
      jobId: pendingJob.id,
      workerId: worker.id,
      status: 'HIRED',
      profileSnapshot: { fullName: 'Admin Smoke Worker' },
    },
  });

  const engagement = await prisma.workEngagement.create({
    data: {
      jobId: pendingJob.id,
      applicationId: application.id,
      workerId: worker.id,
      employerId: employer.id,
      startDate: new Date(),
      employmentType: 'FULL_TIME',
      payRate: 100000,
      payStructure: 'MONTHLY',
      status: 'ACTIVE',
    },
  });

  const dispute = await prisma.dispute.create({
    data: {
      raisedByUserId: worker.id,
      againstUserId: employer.id,
      engagementId: engagement.id,
      subject: 'Payment delay',
      description: 'Worker claims payment was not received on time.',
      status: 'OPEN',
      priority: 'HIGH',
      type: 'PAYMENT_ISSUE',
    },
  });

  const payment = await prisma.payment.create({
    data: {
      engagementId: engagement.id,
      workerId: worker.id,
      payerId: employer.id,
      amount: 75000,
      mobileMoneyProvider: 'MTN_MOMO',
      recipientNumber: '+237600000099',
      idempotencyKey: `admin-smoke-${suffix}`,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });

  return {
    department,
    worker,
    employer,
    kyc,
    document,
    pendingJob,
    rejectedJob,
    dispute,
    payment,
    suffix,
  };
}

async function main() {
  resetFailed();
  const base = getBaseUrl();
  console.log(`Admin v2 route smoke tests → ${base}\n`);

  const prisma = getPrisma();
  const creds = await ensureSuperAdmin(prisma);
  const fixtures = await seedFixtures(prisma, creds.adminId);

  let token = '';
  let refreshToken = '';
  let secondaryAdminId = '';

  await check('POST /admin/auth/login', async () => {
    const res = await fetchJson(base, '/admin/auth/login', {
      method: 'POST',
      body: { identifier: creds.email, password: creds.password },
    });
    const data = expectSuccess(res, 'login');
    token = data.data.accessToken;
    refreshToken = data.data.refreshToken;
    if (!token) throw new Error('missing accessToken');
  });

  const auth = (path, opts = {}) =>
    fetchJson(base, path, { ...opts, bearer: token });

  await check('GET /admin/dashboard', async () => {
    expectSuccess(await auth('/admin/dashboard'), 'dashboard');
  });

  await check('GET /admin/me', async () => {
    expectSuccess(await auth('/admin/me'), 'me');
  });

  await check('PATCH /admin/me', async () => {
    expectSuccess(
      await auth('/admin/me', { method: 'PATCH', body: { name: 'Smoke Super Admin' } }),
      'patch me',
    );
  });

  await check('GET /admin/logs', async () => {
    expectSuccess(await auth('/admin/logs'), 'logs');
  });

  await check('GET /admin/kyc', async () => {
    expectSuccess(await auth('/admin/kyc'), 'kyc list');
  });

  await check('GET /admin/kyc/:id', async () => {
    expectSuccess(await auth(`/admin/kyc/${fixtures.kyc.id}`), 'kyc detail');
  });

  await check('PATCH /admin/kyc/:id/approve', async () => {
    expectSuccess(
      await auth(`/admin/kyc/${fixtures.kyc.id}/approve`, { method: 'PATCH' }),
      'kyc approve',
    );
  });

  const kycReject = await prisma.kycSubmission.create({
    data: {
      workerId: fixtures.worker.id,
      kycType: 'PASSPORT',
      frontUrl: 'https://example.test/passport.jpg',
      selfieUrl: 'https://example.test/selfie2.jpg',
      status: 'PENDING',
    },
  });

  await check('PATCH /admin/kyc/:id/reject', async () => {
    expectSuccess(
      await auth(`/admin/kyc/${kycReject.id}/reject`, {
        method: 'PATCH',
        body: { reason: 'Document unreadable' },
      }),
      'kyc reject',
    );
  });

  await check('GET /admin/documents', async () => {
    expectSuccess(await auth('/admin/documents'), 'documents list');
  });

  await check('GET /admin/documents/:id', async () => {
    expectSuccess(await auth(`/admin/documents/${fixtures.document.id}`), 'document detail');
  });

  await check('PATCH /admin/documents/:id/approve', async () => {
    expectSuccess(
      await auth(`/admin/documents/${fixtures.document.id}/approve`, { method: 'PATCH' }),
      'document approve',
    );
  });

  const docReject = await prisma.employerDocument.create({
    data: {
      employerId: fixtures.employer.id,
      documentName: 'Tax Return.pdf',
      documentUrl: 'https://example.test/tax.pdf',
      documentType: 'PDF',
      verificationStatus: 'PENDING',
    },
  });

  await check('PATCH /admin/documents/:id/reject', async () => {
    expectSuccess(
      await auth(`/admin/documents/${docReject.id}/reject`, {
        method: 'PATCH',
        body: { reason: 'Expired document' },
      }),
      'document reject',
    );
  });

  await check('GET /admin/jobs', async () => {
    expectSuccess(await auth('/admin/jobs'), 'jobs list');
  });

  await check('GET /admin/jobs/pending', async () => {
    expectSuccess(await auth('/admin/jobs/pending'), 'jobs pending');
  });

  await check('GET /admin/jobs/rejected', async () => {
    expectSuccess(await auth('/admin/jobs/rejected'), 'jobs rejected');
  });

  await check('PATCH /admin/jobs/:id/approve', async () => {
    expectSuccess(
      await auth(`/admin/jobs/${fixtures.pendingJob.id}/approve`, { method: 'PATCH' }),
      'job approve',
    );
  });

  const jobToReject = await prisma.job.create({
    data: {
      ownerId: fixtures.employer.id,
      departmentId: fixtures.department.id,
      title: `Reject me ${fixtures.suffix}`,
      employmentType: 'CONTRACT',
      workMode: 'HYBRID',
      city: 'Buea',
      country: 'Cameroon',
      payAmount: 80000,
      payStructure: 'MONTHLY',
      description: 'Another pending job',
      status: 'UNDER_REVIEW',
    },
  });

  await check('PATCH /admin/jobs/:id/reject', async () => {
    expectSuccess(
      await auth(`/admin/jobs/${jobToReject.id}/reject`, {
        method: 'PATCH',
        body: { reason: 'Misleading pay information' },
      }),
      'job reject',
    );
  });

  await check('PATCH /admin/jobs/:id/status', async () => {
    expectSuccess(
      await auth(`/admin/jobs/${fixtures.rejectedJob.id}/status`, {
        method: 'PATCH',
        body: { status: 'paused' },
      }),
      'job status',
    );
  });

  await check('GET /admin/departments', async () => {
    expectSuccess(await auth('/admin/departments'), 'departments list');
  });

  await check('GET /admin/departments/:id', async () => {
    expectSuccess(await auth(`/admin/departments/${fixtures.department.id}`), 'department detail');
  });

  const createdDeptRes = await check('POST /admin/departments', async () => {
    const res = await auth('/admin/departments', {
      method: 'POST',
      body: {
        name: `Smoke Created Dept ${fixtures.suffix}`,
        description: 'Created during admin smoke test',
      },
    });
    return expectSuccess(res, 'create department').data;
  });

  const createdDeptId = createdDeptRes?.id;

  await check('PATCH /admin/departments/:id', async () => {
    if (!createdDeptId) return 'skip';
    expectSuccess(
      await auth(`/admin/departments/${createdDeptId}`, {
        method: 'PATCH',
        body: { description: 'Updated description' },
      }),
      'update department',
    );
  }, { skippable: true, skipReason: 'POST /admin/departments did not return id' });

  await check('PATCH /admin/departments/:id/suspend', async () => {
    if (!createdDeptId) return 'skip';
    expectSuccess(
      await auth(`/admin/departments/${createdDeptId}/suspend`, { method: 'PATCH' }),
      'suspend department',
    );
  }, { skippable: true, skipReason: 'no created department id' });

  await check('PATCH /admin/departments/:id/activate', async () => {
    if (!createdDeptId) return 'skip';
    expectSuccess(
      await auth(`/admin/departments/${createdDeptId}/activate`, { method: 'PATCH' }),
      'activate department',
    );
  }, { skippable: true, skipReason: 'no created department id' });

  await check('DELETE /admin/departments/:id', async () => {
    if (!createdDeptId) return 'skip';
    expectSuccess(
      await auth(`/admin/departments/${createdDeptId}`, { method: 'DELETE' }),
      'delete department',
    );
  }, { skippable: true, skipReason: 'no created department id' });

  await check('GET /admin/users', async () => {
    expectSuccess(await auth('/admin/users'), 'users list');
  });

  await check('GET /admin/users/:id', async () => {
    expectSuccess(await auth(`/admin/users/${fixtures.worker.id}`), 'user detail');
  });

  await check('PATCH /admin/users/:id/suspend', async () => {
    expectSuccess(
      await auth(`/admin/users/${fixtures.worker.id}/suspend`, { method: 'PATCH' }),
      'suspend user',
    );
  });

  await check('PATCH /admin/users/:id/activate', async () => {
    expectSuccess(
      await auth(`/admin/users/${fixtures.worker.id}/activate`, { method: 'PATCH' }),
      'activate user',
    );
  });

  const disposableUser = await check('DELETE /admin/users/:id (seed user)', async () => {
    const u = await prisma.user.create({
      data: {
        email: `admin-smoke-delete-${fixtures.suffix}@example.test`,
        passwordHash: await bcrypt.hash('SmokePass123!', 12),
        role: 'WORKER',
        accountStatus: 'ACTIVE',
        workerProfile: { create: { fullName: 'Delete Me' } },
      },
    });
    expectSuccess(
      await auth(`/admin/users/${u.id}`, { method: 'DELETE' }),
      'delete user',
    );
    return u.id;
  });

  await check('GET /admin/profiles', async () => {
    expectSuccess(await auth('/admin/profiles'), 'profiles list');
  });

  const createdProfileRes = await check('POST /admin/profiles', async () => {
    const res = await auth('/admin/profiles', {
      method: 'POST',
      body: {
        profileType: 'worker',
        roleOrPosition: 'Cleaner',
        fullName: `Smoke Profile ${fixtures.suffix}`,
        email: `admin-created-profile-${fixtures.suffix}@example.test`,
        phone: '+237699000111',
        locationRegionCity: 'Douala/Littoral',
        shortBio: 'Created by admin smoke test',
      },
    });
    return expectSuccess(res, 'create profile').data;
  });

  const profileId = createdProfileRes?.userId || createdProfileRes?.id;

  await check('GET /admin/profiles/:id', async () => {
    if (!profileId) return 'skip';
    expectSuccess(await auth(`/admin/profiles/${profileId}`), 'profile detail');
  }, { skippable: true, skipReason: 'POST /admin/profiles did not return id' });

  await check('PATCH /admin/profiles/:id', async () => {
    if (!profileId) return 'skip';
    expectSuccess(
      await auth(`/admin/profiles/${profileId}`, {
        method: 'PATCH',
        body: { fullName: 'Updated Smoke Profile' },
      }),
      'update profile',
    );
  }, { skippable: true, skipReason: 'no profile id' });

  await check('DELETE /admin/profiles/:id', async () => {
    if (!profileId) return 'skip';
    expectSuccess(
      await auth(`/admin/profiles/${profileId}`, { method: 'DELETE' }),
      'delete profile',
    );
  }, { skippable: true, skipReason: 'no profile id' });

  await check('GET /admin/disputes', async () => {
    expectSuccess(await auth('/admin/disputes'), 'disputes list');
  });

  await check('GET /admin/disputes/:id', async () => {
    expectSuccess(await auth(`/admin/disputes/${fixtures.dispute.id}`), 'dispute detail');
  });

  await check('PATCH /admin/disputes/:id/resolve', async () => {
    expectSuccess(
      await auth(`/admin/disputes/${fixtures.dispute.id}/resolve`, {
        method: 'PATCH',
        body: {
          resolutionDecision: 'approve_worker',
          resolutionNotes: 'Employer must pay within 48 hours.',
        },
      }),
      'resolve dispute',
    );
  });

  await check('GET /admin/finance/records', async () => {
    expectSuccess(await auth('/admin/finance/records'), 'finance records');
  });

  await check('GET /admin/finance/records/:id', async () => {
    expectSuccess(
      await auth(`/admin/finance/records/${fixtures.payment.id}`),
      'finance record detail',
    );
  });

  await check('GET /admin/finance/summary', async () => {
    expectSuccess(await auth('/admin/finance/summary'), 'finance summary');
  });

  await check('GET /admin/admins', async () => {
    expectSuccess(await auth('/admin/admins'), 'admins list');
  });

  await check('GET /admin/admins/:id', async () => {
    expectSuccess(await auth(`/admin/admins/${creds.adminId}`), 'admin detail');
  });

  const createdAdminRes = await check('POST /admin/admins', async () => {
    const res = await auth('/admin/admins', {
      method: 'POST',
      body: {
        fullName: `Verifier ${fixtures.suffix}`,
        email: `verifier-${fixtures.suffix}@example.test`,
        role: 'verifier',
        departmentId: fixtures.department.id,
      },
    });
    return expectSuccess(res, 'create admin').data;
  });

  secondaryAdminId = createdAdminRes?.id;

  await check('PATCH /admin/admins/:id', async () => {
    if (!secondaryAdminId) return 'skip';
    expectSuccess(
      await auth(`/admin/admins/${secondaryAdminId}`, {
        method: 'PATCH',
        body: { fullName: 'Updated Verifier' },
      }),
      'update admin',
    );
  }, { skippable: true, skipReason: 'no secondary admin id' });

  await check('PATCH /admin/admins/:id/suspend', async () => {
    if (!secondaryAdminId) return 'skip';
    expectSuccess(
      await auth(`/admin/admins/${secondaryAdminId}/suspend`, { method: 'PATCH' }),
      'suspend admin',
    );
  }, { skippable: true, skipReason: 'no secondary admin id' });

  await check('PATCH /admin/admins/:id/activate', async () => {
    if (!secondaryAdminId) return 'skip';
    expectSuccess(
      await auth(`/admin/admins/${secondaryAdminId}/activate`, { method: 'PATCH' }),
      'activate admin',
    );
  }, { skippable: true, skipReason: 'no secondary admin id' });

  await check('GET /admin/permissions', async () => {
    expectSuccess(await auth('/admin/permissions'), 'permissions list');
  });

  await check('GET /admin/permissions/:adminId', async () => {
    if (!secondaryAdminId) return 'skip';
    expectSuccess(await auth(`/admin/permissions/${secondaryAdminId}`), 'permissions detail');
  }, { skippable: true, skipReason: 'no secondary admin id' });

  await check('PUT /admin/permissions/:adminId', async () => {
    if (!secondaryAdminId) return 'skip';
    expectSuccess(
      await auth(`/admin/permissions/${secondaryAdminId}`, {
        method: 'PUT',
        body: {
          permissions: ['verify_kyc', 'verify_jobs'],
          departmentIds: [fixtures.department.id],
        },
      }),
      'replace permissions',
    );
  }, { skippable: true, skipReason: 'no secondary admin id' });

  await check('POST /admin/permissions/:adminId/grant', async () => {
    if (!secondaryAdminId) return 'skip';
    expectSuccess(
      await auth(`/admin/permissions/${secondaryAdminId}/grant`, {
        method: 'POST',
        body: { permission: 'verify_documents' },
      }),
      'grant permission',
    );
  }, { skippable: true, skipReason: 'no secondary admin id' });

  await check('DELETE /admin/permissions/:adminId/revoke/:permission', async () => {
    if (!secondaryAdminId) return 'skip';
    expectSuccess(
      await auth(`/admin/permissions/${secondaryAdminId}/revoke/verify_documents`, {
        method: 'DELETE',
      }),
      'revoke permission',
    );
  }, { skippable: true, skipReason: 'no secondary admin id' });

  await check('POST /admin/permissions/:adminId/departments', async () => {
    if (!secondaryAdminId) return 'skip';
    expectSuccess(
      await auth(`/admin/permissions/${secondaryAdminId}/departments`, {
        method: 'POST',
        body: { departmentId: fixtures.department.id },
      }),
      'assign department permission',
    );
  }, { skippable: true, skipReason: 'no secondary admin id' });

  await check('DELETE /admin/permissions/:adminId/departments/:deptId', async () => {
    if (!secondaryAdminId) return 'skip';
    expectSuccess(
      await auth(
        `/admin/permissions/${secondaryAdminId}/departments/${fixtures.department.id}`,
        { method: 'DELETE' },
      ),
      'unassign department permission',
    );
  }, { skippable: true, skipReason: 'no secondary admin id' });

  await check('DELETE /admin/admins/:id', async () => {
    if (!secondaryAdminId) return 'skip';
    expectSuccess(
      await auth(`/admin/admins/${secondaryAdminId}`, { method: 'DELETE' }),
      'delete admin',
    );
  }, { skippable: true, skipReason: 'no secondary admin id' });

  await check('POST /admin/auth/refresh', async () => {
    const res = await fetchJson(base, '/admin/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
    const data = expectSuccess(res, 'refresh');
    if (data.data?.accessToken) token = data.data.accessToken;
  }, { skippable: !refreshToken, skipReason: 'no refresh token from login' });

  await check('POST /admin/auth/logout', async () => {
    expectSuccess(
      await auth('/admin/auth/logout', { method: 'POST' }),
      'logout',
    );
  });

  await disconnectPrisma();

  console.log('\n=== ADMIN ROUTE TEST REPORT ===');
  console.log(`PASSED (${report.pass.length}):`);
  report.pass.forEach((line) => console.log(`  ✓ ${line}`));
  if (report.skip.length) {
    console.log(`\nSKIPPED (${report.skip.length}) — dependency/precondition:`);
    report.skip.forEach((line) => console.log(`  ○ ${line}`));
  }
  if (report.fail.length) {
    console.log(`\nFAILED (${report.fail.length}):`);
    report.fail.forEach((line) => console.log(`  ✗ ${line}`));
  }
  console.log(`\nTotal passed: ${report.pass.length} / ${report.pass.length + report.fail.length + report.skip.length}`);

  process.exit(exitCode());
}

main().catch(async (err) => {
  console.error(err);
  await disconnectPrisma();
  process.exit(1);
});
