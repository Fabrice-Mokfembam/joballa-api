#!/usr/bin/env node
/**
 * Manually verify an employer (dev/staging) when admin panel is unavailable.
 *
 *   node scripts/verify-employer.mjs --email=fabricekongnyuy2@gmail.com
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

async function verifyEmployer(prisma, user) {
  if (user.role !== 'EMPLOYER') {
    throw new Error(`User ${user.email} has role ${user.role}, not EMPLOYER.`);
  }

  let profile = user.employerProfile;
  if (!profile) {
    profile = await prisma.employerProfile.create({
      data: {
        userId: user.id,
        companyName: user.email?.split('@')[0] ?? 'Employer',
        contactPersonName: user.email?.split('@')[0] ?? 'Employer',
        verificationStatus: 'VERIFIED',
      },
    });
  } else {
    profile = await prisma.employerProfile.update({
      where: { id: profile.id },
      data: { verificationStatus: 'VERIFIED' },
    });
  }

  const now = new Date();
  const docs = await prisma.employerDocument.updateMany({
    where: {
      employerId: user.id,
      verificationStatus: { in: ['PENDING', 'UNDER_REVIEW', 'NOT_SUBMITTED', 'CHANGES_REQUESTED'] },
    },
    data: { verificationStatus: 'VERIFIED', verifiedAt: now },
  });

  const scores = await prisma.submissionScore.updateMany({
    where: { targetType: 'ACCOUNT', targetId: user.id },
    data: { tier: 'AUTO_APPROVED', score: 100, reviewedAt: now },
  });

  return { profile, docs: docs.count, scores: scores.count };
}

async function main() {
  const email = (arg('email') || process.env.VERIFY_EMPLOYER_EMAIL || '').trim().toLowerCase();
  const password = arg('password') || process.env.VERIFY_EMPLOYER_PASSWORD || '';
  const createIfMissing = process.argv.includes('--create-if-missing');

  if (!email) {
    console.error(
      'Usage: node scripts/verify-employer.mjs --email=employer@example.com [--password=...] [--create-if-missing]',
    );
    process.exit(1);
  }

  const prisma = getPrisma();
  let user = await prisma.user.findFirst({
    where: { email },
    include: { employerProfile: true },
  });

  if (!user && createIfMissing) {
    if (!password || password.length < 8) {
      console.error('--create-if-missing requires --password (min 8 chars).');
      process.exit(1);
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const localPart = email.split('@')[0] ?? 'Employer';
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'EMPLOYER',
        accountStatus: 'ACTIVE',
        preferredLanguage: 'ENG',
        employerProfile: {
          create: {
            companyName: localPart,
            contactPersonName: localPart,
            verificationStatus: 'VERIFIED',
          },
        },
      },
      include: { employerProfile: true },
    });
    console.log('Created new employer account (already verified).');
  }

  if (!user) {
    console.error(`No user found for email: ${email}`);
    console.error('Register on the app first, or re-run with --create-if-missing --password=...');
    process.exit(1);
  }

  const { profile, docs, scores } = await verifyEmployer(prisma, user);

  console.log('Employer verified successfully.');
  console.log({
    userId: user.id,
    email: user.email,
    companyName: profile.companyName,
    verificationStatus: profile.verificationStatus,
    documentsUpdated: docs,
    submissionScoresUpdated: scores,
  });

  await disconnectPrisma();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
