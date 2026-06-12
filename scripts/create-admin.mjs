#!/usr/bin/env node
/**
 * Create an admin account in admin_accounts (separate from platform users).
 *
 *   node scripts/create-admin.mjs --email=superadmin@joballa.cm --password="YourPass123!" --role=super_admin
 */
import bcrypt from 'bcrypt';
import { loadRootDotenvOptional } from './lib/dotenv-lite.mjs';
import { DEFAULT_ADMIN_PASSWORD } from './lib/admin-default-password.mjs';
import { getPrisma, disconnectPrisma } from './employer-portal/lib/prisma.mjs';

const ALL_ADMIN_PERMISSIONS = [
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

function defaultPermissionsForRole(role) {
  if (role === 'SUPER_ADMIN') return ALL_ADMIN_PERMISSIONS;
  if (role === 'ADMIN_MANAGER') {
    return ALL_ADMIN_PERMISSIONS.filter((p) => p !== 'manage_admins');
  }
  if (role === 'VERIFIER') {
    return ['verify_jobs', 'resolve_disputes', 'verify_documents', 'verify_kyc', 'create_profiles'];
  }
  return ['create_profiles'];
}

loadRootDotenvOptional();

const BCRYPT_ROUNDS = 12;

function arg(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const ROLE_MAP = {
  super_admin: 'SUPER_ADMIN',
  superadmin: 'SUPER_ADMIN',
  admin_manager: 'ADMIN_MANAGER',
  manager: 'ADMIN_MANAGER',
  verifier: 'VERIFIER',
  support_agent: 'SUPPORT_AGENT',
  support: 'SUPPORT_AGENT',
};

async function main() {
  const email = (arg('email') || 'superadmin@joballa.cm').trim().toLowerCase();
  const password = arg('password') || DEFAULT_ADMIN_PASSWORD;
  const roleArg = (arg('role') || 'super_admin').trim().toLowerCase();
  const fullName = arg('name') || 'Joballa Super Admin';
  const departmentId = arg('departmentId') || '';

  const role = ROLE_MAP[roleArg];
  if (!role) {
    console.error('Unknown --role. Use super_admin, admin_manager, verifier, or support_agent');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const prisma = getPrisma();
  const existing = await prisma.adminAccount.findUnique({ where: { email } });
  if (existing) {
    console.error(`Admin already exists: ${email}`);
    await disconnectPrisma();
    process.exit(1);
  }

  const permissions =
    role === 'SUPER_ADMIN'
      ? ALL_ADMIN_PERMISSIONS
      : defaultPermissionsForRole(role);

  const admin = await prisma.adminAccount.create({
    data: {
      email,
      fullName,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role,
      isActive: true,
      invitePending: false,
      permissions: {
        create: permissions.map((permission) => ({ permission })),
      },
      ...(departmentId
        ? { departmentLinks: { create: { departmentId } } }
        : {}),
    },
  });

  console.log('\nAdmin account created.\n');
  console.log('  Email:   ', email);
  console.log('  Password:', password);
  console.log('  Role:    ', role.toLowerCase());
  console.log('  ID:      ', admin.id);
  console.log('\nLogin:');
  console.log('  POST /admin/auth/login');
  console.log(`  Body: { "identifier": "${email}", "password": "…" }`);
  console.log('');

  await disconnectPrisma();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectPrisma();
  process.exit(1);
});
