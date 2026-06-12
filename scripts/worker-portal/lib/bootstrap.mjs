import bcrypt from 'bcrypt';
import { fetchJson } from '../../lib/fetch-json.mjs';
import { getBaseUrl, isRemoteApi } from './config.mjs';
import { getPrisma, disconnectPrisma } from './prisma.mjs';
const BCRYPT_ROUNDS = 12;

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} employerProfileId
 * @param {string} title
 */
async function seedActiveJob(prisma, employerProfileId, title) {
  const job = await prisma.job.create({
    data: {
      employerId: employerProfileId,
      title,
      description: 'Seeded job for worker portal integration tests.',
      category: 'TECH',
      jobType: 'FULL_TIME',
      workMode: 'ON_SITE',
      location: 'Douala, Cameroon',
      city: 'Douala',
      payRate: 150000,
      payStructure: 'MONTHLY',
      requiredSkills: ['Communication'],
      requestedDocuments: [],
      status: 'ACTIVE',
    },
  });
  return job.id;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function seedEngagementForWorker(prisma, params) {
  const { jobId, workerProfileId, employerProfileId } = params;
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });

  const application = await prisma.application.create({
    data: {
      jobId,
      workerId: workerProfileId,
      profileSnapshot: { fullName: 'Worker smoke engagement' },
      status: 'HIRED',
    },
  });

  const engagement = await prisma.workEngagement.create({
    data: {
      jobId,
      workerId: workerProfileId,
      employerId: employerProfileId,
      applicationId: application.id,
      startDate: new Date(),
      agreedRate: job.payRate,
      payStructure: job.payStructure,
      status: 'ACTIVE',
    },
  });

  return { applicationId: application.id, engagementId: engagement.id };
}

/**
 * @typedef {object} WorkerTestState
 * @property {string} base
 * @property {string} workerToken
 * @property {string} workerUserId
 * @property {string} workerProfileId
 * @property {string} workerEmail
 * @property {string} [employerToken]
 * @property {string} [jobId]
 * @property {string} [applicationId]
 * @property {string} [engagementId]
 * @property {string} [workHistoryId]
 * @property {string} [educationId]
 * @property {string} [certificationId]
 * @property {Record<string, string>} jar
 */

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} workerProfileId
 */
async function ensureApplyReadyProfile(prisma, workerProfileId) {
  await prisma.workerProfile.update({
    where: { id: workerProfileId },
    data: {
      fullName: 'Worker Portal Smoke',
      firstName: 'Worker',
      lastName: 'Smoke',
      professionalTitle: 'Full Stack Developer',
      bio: 'Profile seeded for worker portal integration tests.',
      city: 'Douala',
      region: 'Littoral',
      country: 'Cameroon',
      skills: ['React', 'TypeScript', 'Node.js', 'Communication'],
      languagesSpoken: ['EN', 'FR'],
      industries: ['Technology'],
      preferredJobCategories: ['TECH'],
      profileCompleteness: 75,
      mobileMoneyProvider: 'MTN_MOMO',
      mobileMoneyNumber: '+237600000099',
      availabilityStatus: 'AVAILABLE',
    },
  });

  const existingHistory = await prisma.workHistory.findFirst({
    where: { workerId: workerProfileId },
  });
  if (!existingHistory) {
    await prisma.workHistory.create({
      data: {
        workerId: workerProfileId,
        company: 'Smoke Corp',
        role: 'Developer',
        startDate: new Date('2022-01-01'),
        isCurrent: true,
      },
    });
  }
}

/**
 * Seed worker + employer + ACTIVE job via Prisma (same DB as deployed API).
 * @param {object} [opts]
 * @param {boolean} [opts.seedEngagement]
 */
export async function bootstrapWorkerViaPrisma(opts = {}) {
  const base = getBaseUrl();
  const prisma = getPrisma();
  const suffix = `${Date.now()}`;
  const password = `WorkerTest99!${suffix.slice(-6)}`;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const workerEmail = `worker-portal-${suffix}@example.test`;
  const employerEmail = `employer-for-worker-${suffix}@example.test`;

  const workerUser = await prisma.user.create({
    data: {
      email: workerEmail,
      passwordHash,
      role: 'WORKER',
      verificationStatus: 'VERIFIED',
      isActive: true,
      languagePreference: 'EN',
    },
  });

  const workerProfile = await prisma.workerProfile.create({
    data: {
      userId: workerUser.id,
      fullName: 'Worker Portal Smoke',
      preferredJobCategories: ['TECH'],
      languagesSpoken: ['EN'],
      skills: ['React'],
      city: 'Douala',
    },
  });

  await ensureApplyReadyProfile(prisma, workerProfile.id);

  const employerUser = await prisma.user.create({
    data: {
      email: employerEmail,
      passwordHash,
      role: 'EMPLOYER',
      verificationStatus: 'VERIFIED',
      isActive: true,
      languagePreference: 'EN',
    },
  });

  const employerProfile = await prisma.employerProfile.create({
    data: {
      userId: employerUser.id,
      companyName: `Worker Smoke Employer ${suffix}`,
      verificationStatus: 'VERIFIED',
    },
  });

  const workerLogin = await fetchJson(base, '/auth/login', {
    method: 'POST',
    body: { identifier: workerEmail, password },
  });
  if (!workerLogin.ok || !workerLogin.data?.accessToken) {
    throw new Error(
      `Worker login failed: ${workerLogin.status} ${JSON.stringify(workerLogin.data)}`,
    );
  }

  const employerLogin = await fetchJson(base, '/auth/login', {
    method: 'POST',
    body: { identifier: employerEmail, password },
  });
  if (!employerLogin.ok || !employerLogin.data?.accessToken) {
    throw new Error(
      `Employer login failed: ${employerLogin.status} ${JSON.stringify(employerLogin.data)}`,
    );
  }

  /** @type {WorkerTestState} */
  const state = {
    base,
    workerToken: workerLogin.data.accessToken,
    workerUserId: workerUser.id,
    workerProfileId: workerProfile.id,
    workerEmail,
    employerToken: employerLogin.data.accessToken,
    jar: {},
  };

  state.jobId = await seedActiveJob(
    prisma,
    employerProfile.id,
    `Worker smoke job ${suffix}`,
  );

  if (opts.seedEngagement) {
    const seeded = await seedEngagementForWorker(prisma, {
      jobId: state.jobId,
      workerProfileId: workerProfile.id,
      employerProfileId: employerProfile.id,
    });
    state.applicationId = seeded.applicationId;
    state.engagementId = seeded.engagementId;
  }

  return state;
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.seedEngagement] — create HIRED application + ACTIVE engagement
 */
export async function bootstrapWorkerTestState(opts = {}) {
  const base = getBaseUrl();

  if (process.env.JOBALLA_WORKER_BOOTSTRAP === '1') {
    try {
      return await bootstrapWorkerViaPrisma(opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Prisma bootstrap failed (${msg}); trying register/verify…`);
    }
  } else if (isRemoteApi(base)) {
    const hasLogin =
      (process.env.JOBALLA_WORKER_TOKEN ?? '').trim() ||
      ((process.env.JOBALLA_WORKER_IDENTIFIER ??
        process.env.JOBALLA_WORKER_EMAIL ??
        '') &&
        (process.env.JOBALLA_WORKER_PASSWORD ?? '').trim());
    if (!hasLogin) {
      throw new Error(
        'Remote worker tests need JOBALLA_WORKER_IDENTIFIER + JOBALLA_WORKER_PASSWORD, ' +
          'JOBALLA_WORKER_TOKEN, or JOBALLA_WORKER_BOOTSTRAP=1 (DATABASE_URL / DIRECT_DB_URL).',
      );
    }
  }

  const fixedOtp = (process.env.JOBALLA_DEV_FIXED_OTP ?? '').trim();
  if (!/^[0-9]{6}$/.test(fixedOtp)) {
    throw new Error(
      'Set JOBALLA_DEV_FIXED_OTP (six digits) in .env for local register/verify bootstrap.',
    );
  }

  const suffix = `${Date.now()}`;
  const password = `WorkerTest99!${suffix.slice(-6)}`;
  const workerEmail = `worker-portal-${suffix}@example.test`;
  const employerEmail = `employer-for-worker-${suffix}@example.test`;
  const jar = /** @type {Record<string, string>} */ ({});

  async function registerVerify(email, role) {
    const canonical = email.toLowerCase();
    const reg = await fetchJson(base, '/auth/register', {
      method: 'POST',
      body: { email, password, role, languagePreference: 'EN' },
    });
    if (!reg.ok) {
      throw new Error(
        `register ${role} failed: ${reg.status} ${JSON.stringify(reg.data)}`,
      );
    }
    const ver = await fetchJson(base, '/auth/verify', {
      method: 'POST',
      jar,
      body: {
        identifier: canonical,
        code: fixedOtp,
        purpose: 'registration',
      },
    });
    if (!ver.ok || !ver.data?.accessToken) {
      throw new Error(
        `verify ${role} failed: ${ver.status} ${JSON.stringify(ver.data)}`,
      );
    }
    return { token: ver.data.accessToken, userId: ver.data.user.id };
  }

  const worker = await registerVerify(workerEmail, 'WORKER');
  const employer = await registerVerify(employerEmail, 'EMPLOYER');

  const prisma = getPrisma();
  const workerProfile = await prisma.workerProfile.findUnique({
    where: { userId: worker.userId },
  });
  if (!workerProfile) {
    throw new Error('Worker profile missing after verify.');
  }
  await ensureApplyReadyProfile(prisma, workerProfile.id);

  /** @type {WorkerTestState} */
  const state = {
    base,
    workerToken: worker.token,
    workerUserId: worker.userId,
    workerProfileId: workerProfile.id,
    workerEmail,
    employerToken: employer.token,
    jar,
  };

  const employerProfile = await prisma.employerProfile.findFirst({
    where: { userId: employer.userId },
  });
  if (!employerProfile) {
    throw new Error('Employer profile missing after verify.');
  }

  state.jobId = await seedActiveJob(
    prisma,
    employerProfile.id,
    `Worker smoke job ${suffix}`,
  );

  if (opts.seedEngagement) {
    const seeded = await seedEngagementForWorker(prisma, {
      jobId: state.jobId,
      workerProfileId: workerProfile.id,
      employerProfileId: employerProfile.id,
    });
    state.applicationId = seeded.applicationId;
    state.engagementId = seeded.engagementId;
  }

  return state;
}

/**
 * @returns {Promise<WorkerTestState | null>}
 */
export async function loadStateFromEnv() {
  const base = getBaseUrl();
  const token = (process.env.JOBALLA_WORKER_TOKEN ?? '').trim();
  if (token) {
    return stateFromToken(base, token);
  }

  const identifier = (
    process.env.JOBALLA_WORKER_IDENTIFIER ??
    process.env.JOBALLA_WORKER_EMAIL ??
    ''
  ).trim();
  const password = (process.env.JOBALLA_WORKER_PASSWORD ?? '').trim();
  if (identifier && password) {
    const login = await fetchJson(base, '/auth/login', {
      method: 'POST',
      body: { identifier, password },
    });
    if (!login.ok || !login.data?.accessToken) return null;
    if (login.data.user?.role !== 'WORKER') return null;
    return stateFromToken(base, login.data.accessToken);
  }

  return null;
}

/**
 * @param {string} base
 * @param {string} token
 * @returns {Promise<WorkerTestState | null>}
 */
async function resolveJobIdFromSearch(base, token) {
  const search = await fetchJson(base, '/api/jobs?page=1&limit=10', {
    bearer: token,
  });
  if (!search.ok || !Array.isArray(search.data?.items)) return undefined;
  const first = search.data.items[0];
  return first?.id ?? first?.jobId;
}

async function resolveEngagementIdFromList(base, token) {
  const list = await fetchJson(base, '/api/worker/engagements?limit=5', {
    bearer: token,
  });
  if (!list.ok || !Array.isArray(list.data?.items) || !list.data.items[0]) {
    return undefined;
  }
  return list.data.items[0].id;
}

async function stateFromToken(base, token) {
  const me = await fetchJson(base, '/api/worker/me', { bearer: token });
  if (!me.ok || !me.data?.workerProfile?.id) return null;

  let jobId = process.env.JOBALLA_TEST_JOB_ID?.trim();
  if (!jobId) {
    jobId = await resolveJobIdFromSearch(base, token);
  }

  let engagementId = process.env.JOBALLA_TEST_ENGAGEMENT_ID?.trim();
  if (!engagementId) {
    engagementId = await resolveEngagementIdFromList(base, token);
  }

  return {
    base,
    workerToken: token,
    workerUserId: me.data.id,
    workerProfileId: me.data.workerProfile.id,
    workerEmail: me.data.email ?? '',
    jobId,
    applicationId: process.env.JOBALLA_TEST_APPLICATION_ID,
    engagementId,
    jar: {},
  };
}

export async function teardown() {
  await disconnectPrisma();
}
