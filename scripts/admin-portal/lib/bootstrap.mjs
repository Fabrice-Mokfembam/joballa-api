import bcrypt from 'bcrypt';
import { fetchJson } from '../../lib/fetch-json.mjs';
import { getBaseUrl, isRemoteApi } from './config.mjs';
import { adminFetch, adminLogin } from './http.mjs';
import { getPrisma, disconnectPrisma } from './prisma.mjs';

const BCRYPT_ROUNDS = 12;

/**
 * @typedef {object} AdminTestState
 * @property {string} base
 * @property {string} token
 * @property {string} userId
 * @property {string} email
 * @property {string} [password] — set when bootstrapped (for change-password / re-login)
 * @property {string} role — `super_admin` | `admin`
 * @property {string} [kycId]
 * @property {string} [documentId]
 * @property {string} [jobId]
 * @property {string} [reportId]
 * @property {string} [departmentId]
 * @property {string} [workerUserId]
 * @property {string} [employerUserId]
 * @property {Record<string, string>} jar
 */

/**
 * @param {object} [opts]
 * @param {boolean} [opts.seedModeration] — seed KYC, document, job, dispute rows
 */
export async function bootstrapAdminTestState(opts = {}) {
  const base = getBaseUrl();
  const prisma = getPrisma();
  const suffix = `${Date.now()}`;
  const email = `admin-portal-${suffix}@example.test`;
  const password = `AdminTest99!${suffix.slice(-6)}`;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const adminUser = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      role: 'SUPER_ADMIN',
      verificationStatus: 'VERIFIED',
      isActive: true,
      languagePreference: 'EN',
    },
  });

  const login = await adminLogin(base, email, password);
  if (!login.ok || !login.data?.accessToken) {
    throw new Error(
      `Admin login failed: ${login.status} ${JSON.stringify(login.envelope ?? login.data)}`,
    );
  }

  /** @type {AdminTestState} */
  const state = {
    base,
    token: login.data.accessToken,
    userId: adminUser.id,
    email,
    password,
    role: 'super_admin',
    jar: {},
  };

  if (opts.seedModeration !== false) {
    const mod = await seedModerationFixtures(prisma, suffix);
    Object.assign(state, mod);
  }

  return state;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} suffix
 */
async function seedModerationFixtures(prisma, suffix) {
  const workerEmail = `admin-test-worker-${suffix}@example.test`;
  const employerEmail = `admin-test-employer-${suffix}@example.test`;
  const pw = await bcrypt.hash(`Worker99!${suffix}`, BCRYPT_ROUNDS);

  const workerUser = await prisma.user.create({
    data: {
      email: workerEmail,
      passwordHash: pw,
      role: 'WORKER',
      verificationStatus: 'VERIFIED',
      isActive: true,
    },
  });

  const workerProfile = await prisma.workerProfile.create({
    data: {
      userId: workerUser.id,
      fullName: 'Admin Test Worker',
      preferredJobCategories: [],
      languagesSpoken: ['EN'],
      skills: ['Cleaning'],
    },
  });

  const kyc = await prisma.kYCSubmission.create({
    data: {
      workerId: workerProfile.id,
      documentType: 'NATIONAL_ID',
      frontImageUrl: 'https://example.test/kyc-front.jpg',
      backImageUrl: 'https://example.test/kyc-back.jpg',
      status: 'PENDING',
    },
  });

  const document = await prisma.workerDocument.create({
    data: {
      workerId: workerProfile.id,
      type: 'CV',
      fileName: 'cv.pdf',
      fileUrl: 'https://example.test/cv.pdf',
      mimeType: 'application/pdf',
      reviewStatus: 'PENDING',
    },
  });

  const employerUser = await prisma.user.create({
    data: {
      email: employerEmail,
      passwordHash: pw,
      role: 'EMPLOYER',
      verificationStatus: 'VERIFIED',
      isActive: true,
    },
  });

  const employerProfile = await prisma.employerProfile.create({
    data: {
      userId: employerUser.id,
      companyName: `Admin Test Employer ${suffix}`,
      verificationStatus: 'VERIFIED',
    },
  });

  const job = await prisma.job.create({
    data: {
      employerId: employerProfile.id,
      title: `Admin Review Job ${suffix}`,
      description: 'Job awaiting admin moderation in smoke tests.',
      category: 'Domestic',
      jobType: 'PART_TIME',
      location: 'Douala',
      payRate: 5000,
      payStructure: 'HOURLY',
      requiredSkills: ['Cleaning'],
      requestedDocuments: [],
      status: 'UNDER_REVIEW',
    },
  });

  const report = await prisma.dispute.create({
    data: {
      raisedByUserId: workerUser.id,
      againstUserId: employerUser.id,
      subject: `Admin test dispute ${suffix}`,
      description: 'Payment not received after completed work.',
      status: 'OPEN',
    },
  });

  return {
    kycId: kyc.id,
    documentId: document.id,
    jobId: job.id,
    reportId: report.id,
    workerUserId: workerUser.id,
    employerUserId: employerUser.id,
  };
}

/**
 * @returns {Promise<AdminTestState | null>}
 */
export async function loadStateFromEnv() {
  const base = getBaseUrl();
  const token = (
    process.env.JOBALLA_ADMIN_TOKEN ??
    process.env.JOBALLA_SUPER_ADMIN_TOKEN ??
    ''
  ).trim();

  if (token) {
    const me = await adminFetch(base, '/auth/me', { bearer: token });
    if (!me.ok || !me.data?.id) return null;
    return {
      base,
      token,
      userId: me.data.id,
      email: me.data.email ?? '',
      role: me.data.role ?? 'admin',
      kycId: process.env.JOBALLA_TEST_KYC_ID,
      documentId: process.env.JOBALLA_TEST_DOCUMENT_ID,
      jobId: process.env.JOBALLA_TEST_JOB_ID,
      reportId: process.env.JOBALLA_TEST_REPORT_ID,
      departmentId: process.env.JOBALLA_TEST_DEPARTMENT_ID,
      jar: {},
    };
  }

  const identifier = (
    process.env.JOBALLA_ADMIN_IDENTIFIER ??
    process.env.JOBALLA_ADMIN_EMAIL ??
    ''
  ).trim();
  const password = (process.env.JOBALLA_ADMIN_PASSWORD ?? '').trim();
  if (!identifier || !password) return null;

  const login = await adminLogin(base, identifier, password);
  if (!login.ok || !login.data?.accessToken) return null;

  const me = await adminFetch(base, '/auth/me', {
    bearer: login.data.accessToken,
  });

  return {
    base,
    token: login.data.accessToken,
    userId: me.data?.id ?? login.data.user?.id ?? '',
    email: me.data?.email ?? identifier,
    role: me.data?.role ?? login.data.user?.role ?? 'admin',
    kycId: process.env.JOBALLA_TEST_KYC_ID,
    documentId: process.env.JOBALLA_TEST_DOCUMENT_ID,
    jobId: process.env.JOBALLA_TEST_JOB_ID,
    reportId: process.env.JOBALLA_TEST_REPORT_ID,
    departmentId: process.env.JOBALLA_TEST_DEPARTMENT_ID,
    jar: {},
  };
}

export async function teardown() {
  await disconnectPrisma();
}
