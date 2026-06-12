#!/usr/bin/env node
/**
 * Manually verify a worker's KYC (dev/staging) when admin panel is unavailable.
 *
 *   node scripts/verify-worker.mjs --email=fabricemokfembam@gmail.com
 *   node scripts/verify-worker.mjs --email=worker@example.com --password="..." --create-if-missing
 */
import bcrypt from 'bcrypt';
import { loadRootDotenvOptional } from './lib/dotenv-lite.mjs';
import { getPrisma, disconnectPrisma } from './employer-portal/lib/prisma.mjs';

loadRootDotenvOptional();

const BCRYPT_ROUNDS = 12;

function arg(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function verifyWorkerKyc(prisma, user) {
  if (user.role !== 'WORKER') {
    throw new Error(`User ${user.email} has role ${user.role}, not WORKER.`);
  }

  let profile = user.workerProfile;
  if (!profile) {
    profile = await prisma.workerProfile.create({
      data: {
        userId: user.id,
        fullName: user.email?.split('@')[0] ?? 'Worker',
        verificationStatus: 'VERIFIED',
        languages: [],
        skills: [],
        preferredJobCategories: [],
        preferredJobTypes: [],
      },
    });
  } else {
    profile = await prisma.workerProfile.update({
      where: { id: profile.id },
      data: { verificationStatus: 'VERIFIED' },
    });
  }

  const now = new Date();
  const kyc = await prisma.kycSubmission.updateMany({
    where: {
      workerId: user.id,
      status: { in: ['PENDING', 'UNDER_REVIEW', 'NOT_SUBMITTED', 'CHANGES_REQUESTED', 'REJECTED'] },
    },
    data: {
      status: 'VERIFIED',
      verifiedAt: now,
      rejectionReason: null,
    },
  });

  const scores = await prisma.submissionScore.updateMany({
    where: {
      targetType: { in: ['ACCOUNT', 'KYC_DOCUMENT'] },
      targetId: user.id,
    },
    data: { tier: 'AUTO_APPROVED', score: 100, reviewedAt: now },
  });

  return { profile, kycUpdated: kyc.count, scoresUpdated: scores.count };
}

async function main() {
  const email = (arg('email') || process.env.VERIFY_WORKER_EMAIL || '').trim().toLowerCase();
  const password = arg('password') || process.env.VERIFY_WORKER_PASSWORD || '';
  const createIfMissing = process.argv.includes('--create-if-missing');

  if (!email) {
    console.error(
      'Usage: node scripts/verify-worker.mjs --email=worker@example.com [--password=...] [--create-if-missing]',
    );
    process.exit(1);
  }

  const prisma = getPrisma();
  let user = await prisma.user.findFirst({
    where: { email },
    include: { workerProfile: true },
  });

  if (!user && createIfMissing) {
    if (!password || password.length < 8) {
      console.error('--create-if-missing requires --password (min 8 chars).');
      process.exit(1);
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const localPart = email.split('@')[0] ?? 'Worker';
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'WORKER',
        accountStatus: 'ACTIVE',
        preferredLanguage: 'ENG',
        workerProfile: {
          create: {
            fullName: localPart,
            verificationStatus: 'VERIFIED',
            languages: [],
            skills: [],
            preferredJobCategories: [],
            preferredJobTypes: [],
          },
        },
      },
      include: { workerProfile: true },
    });
    console.log('Created new worker account (KYC already verified).');
  }

  if (!user) {
    console.error(`No user found for email: ${email}`);
    console.error('Register on the app first, or re-run with --create-if-missing --password=...');
    process.exit(1);
  }

  const { profile, kycUpdated, scoresUpdated } = await verifyWorkerKyc(prisma, user);

  console.log('Worker KYC verified successfully.');
  console.log({
    userId: user.id,
    email: user.email,
    fullName: profile.fullName,
    verificationStatus: profile.verificationStatus,
    kycSubmissionsUpdated: kycUpdated,
    submissionScoresUpdated: scoresUpdated,
  });

  await disconnectPrisma();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
