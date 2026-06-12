#!/usr/bin/env node
import bcrypt from 'bcrypt';
import { loadRootDotenvOptional } from './lib/dotenv-lite.mjs';
import { DEFAULT_ADMIN_PASSWORD } from './lib/admin-default-password.mjs';
import { getPrisma, disconnectPrisma } from './worker-portal/lib/prisma.mjs';
import { pathToFileURL } from 'url';

const BCRYPT_ROUNDS = 12;

/**
 * Reset every admin account to the default password and clear invite pending.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} [password]
 */
export async function resetAllAdminPasswords(
  prisma,
  password = DEFAULT_ADMIN_PASSWORD,
) {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const admins = await prisma.adminAccount.findMany({
    select: { id: true, email: true, invitePending: true },
    orderBy: { email: 'asc' },
  });
  if (!admins.length) {
    console.log('No admin accounts found.');
    return { count: 0, password };
  }
  const result = await prisma.adminAccount.updateMany({
    data: {
      passwordHash,
      invitePending: false,
      isActive: true,
    },
  });
  for (const admin of admins) {
    console.log(`  ${admin.email}${admin.invitePending ? ' (was pending)' : ''}`);
  }
  return { count: result.count, password };
}

async function main() {
  loadRootDotenvOptional();
  const prisma = getPrisma();
  console.log(`Resetting all admin passwords to default (${DEFAULT_ADMIN_PASSWORD})…`);
  const summary = await resetAllAdminPasswords(prisma);
  console.log(`Updated ${summary.count} admin account(s).`);
  await disconnectPrisma();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
