import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AdminRole } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ALL_ADMIN_PERMISSIONS } from '../../src/modules/v2/admin/admin.constants';

const FIXED_OTP = process.env.JOBALLA_DEV_FIXED_OTP ?? '555555';

function useEnvCredentials() {
  return process.env.JOBALLA_E2E_USE_ENV_CREDENTIALS === '1';
}

export async function loginWorker(
  app: INestApplication<App>,
  identifier: string,
  password: string,
): Promise<string> {
  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ identifier, password });

  if (login.status !== 200 || !login.body.accessToken) {
    throw new Error(
      `Worker login failed (${login.status}): ${JSON.stringify(login.body)}`,
    );
  }
  return login.body.accessToken as string;
}

export async function bootstrapWorkerAccessToken(
  app: INestApplication<App>,
): Promise<string> {
  const envId = process.env.JOBALLA_WORKER_IDENTIFIER?.trim();
  const envPassword = process.env.JOBALLA_WORKER_PASSWORD?.trim();
  if (useEnvCredentials() && envId && envPassword) {
    return loginWorker(app, envId, envPassword);
  }

  const suffix = `${Date.now()}`;
  const email = `worker-e2e-${suffix}@example.test`.toLowerCase();
  const password = `WorkerE2e99!${suffix.slice(-6)}`;

  const register = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email,
      password,
      role: 'WORKER',
      preferredLanguage: 'EN',
    });

  if (register.status !== 200) {
    throw new Error(
      `Worker register failed (${register.status}): ${JSON.stringify(register.body)}`,
    );
  }

  const verify = await request(app.getHttpServer())
    .post('/auth/verify')
    .send({ identifier: email, otp: FIXED_OTP });

  if (verify.status !== 201 || !verify.body.accessToken) {
    throw new Error(
      `Worker verify failed (${verify.status}): ${JSON.stringify(verify.body)}`,
    );
  }

  return verify.body.accessToken as string;
}

export async function bootstrapEmployerAccessToken(
  app: INestApplication<App>,
): Promise<string> {
  const envId = process.env.JOBALLA_EMPLOYER_IDENTIFIER?.trim();
  const envPassword = process.env.JOBALLA_EMPLOYER_PASSWORD?.trim();
  if (useEnvCredentials() && envId && envPassword) {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: envId, password: envPassword });
    if (login.status !== 200 || !login.body.accessToken) {
      throw new Error(
        `Employer login failed (${login.status}): ${JSON.stringify(login.body)}`,
      );
    }
    return login.body.accessToken as string;
  }

  const prisma = app.get(PrismaService);
  const suffix = `${Date.now()}`;
  const password = `EmployerE2e99!${suffix.slice(-4)}`;
  const email = `employer-e2e-${suffix}@example.test`.toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'EMPLOYER',
      accountStatus: 'ACTIVE',
      preferredLanguage: 'ENG',
      employerProfile: {
        create: {
          companyName: `E2E Employer ${suffix}`,
          contactPersonName: 'E2E Contact',
          verificationStatus: 'VERIFIED',
        },
      },
    },
  });

  return loginWorker(app, email, password);
}

export async function bootstrapAdminAccessToken(
  app: INestApplication<App>,
): Promise<string> {
  const envId =
    process.env.JOBALLA_ADMIN_IDENTIFIER?.trim() ||
    process.env.JOBALLA_ADMIN_EMAIL?.trim();
  const envPassword = process.env.JOBALLA_ADMIN_PASSWORD?.trim();

  if (useEnvCredentials() && envId && envPassword) {
    const login = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ identifier: envId, password: envPassword });
    const token = login.body?.data?.accessToken ?? login.body?.accessToken;
    if (login.status !== 200 || !token) {
      throw new Error(
        `Admin login failed (${login.status}): ${JSON.stringify(login.body)}`,
      );
    }
    return token as string;
  }

  const prisma = app.get(PrismaService);
  const suffix = `${Date.now()}`;
  const password = `AdminE2e99!${suffix.slice(-4)}`;
  const email = `admin-e2e-${suffix}@example.test`.toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.adminAccount.create({
    data: {
      fullName: 'E2E Super Admin',
      email,
      passwordHash,
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
      permissions: {
        create: ALL_ADMIN_PERMISSIONS.map((permission) => ({ permission })),
      },
    },
  });

  const login = await request(app.getHttpServer())
    .post('/admin/auth/login')
    .send({ identifier: email, password });

  const token = login.body?.data?.accessToken ?? login.body?.accessToken;
  if (login.status !== 200 || !token) {
    throw new Error(
      `Admin bootstrap login failed (${login.status}): ${JSON.stringify(login.body)}`,
    );
  }
  return token as string;
}
