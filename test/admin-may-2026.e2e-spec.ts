import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Admin routes — May 2026 (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const identifier =
      process.env.JOBALLA_ADMIN_IDENTIFIER?.trim() ||
      process.env.JOBALLA_ADMIN_EMAIL?.trim();
    const password = process.env.JOBALLA_ADMIN_PASSWORD?.trim();

    if (identifier && password) {
      const login = await request(app.getHttpServer())
        .post('/admin/auth/login')
        .send({ identifier, password });
      const token = login.body?.data?.accessToken ?? login.body?.accessToken;
      if (login.status !== 200 || !token) {
        throw new Error(
          `Admin login failed (${login.status}): ${JSON.stringify(login.body)}`,
        );
      }
      accessToken = token;
      return;
    }

    const prisma = app.get(PrismaService);
    const suffix = `${Date.now()}`;
    const testPassword = `AdminE2e99!${suffix.slice(-4)}`;
    const email = `admin-e2e-${suffix}@example.test`;
    const passwordHash = await bcrypt.hash(testPassword, 12);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'SUPER_ADMIN',
        verificationStatus: 'VERIFIED',
        isActive: true,
        languagePreference: 'EN',
      },
    });

    const login = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ identifier: email, password: testPassword });

    const token = login.body?.data?.accessToken ?? login.body?.accessToken;
    if (login.status !== 200 || !token) {
      throw new Error(
        `Admin bootstrap login failed (${login.status}): ${JSON.stringify(login.body)}`,
      );
    }
    accessToken = token;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  const bearer = () => ({ Authorization: `Bearer ${accessToken}` });
  const data = (body: { data?: unknown }) => body.data ?? body;

  it('GET /admin/auth/me — no departmentId', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/auth/me')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const me = data(res.body) as Record<string, unknown>;
    expect(me.permissions).toBeDefined();
    expect(me).not.toHaveProperty('departmentId');
    expect(me).not.toHaveProperty('departmentName');
  });

  it('GET /admin/admins', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/admins')
      .set(bearer());
    expect(res.status).toBe(200);
    const payload = data(res.body) as { items: unknown[] };
    expect(Array.isArray(payload.items)).toBe(true);
  });

  it('GET /admin/departments — email + jobs', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/departments')
      .set(bearer());
    expect(res.status).toBe(200);
    const payload = data(res.body) as {
      items: Array<Record<string, unknown>>;
    };
    expect(Array.isArray(payload.items)).toBe(true);
    if (payload.items.length > 0) {
      expect(payload.items[0]).toHaveProperty('email');
      expect(payload.items[0]).toHaveProperty('jobs');
      expect(payload.items[0]).not.toHaveProperty('pending');
    }
  });

  it('POST /admin/departments — rejects staff password', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/departments')
      .set(bearer())
      .send({
        name: 'E2E Test Dept',
        email: `dept-e2e-${Date.now()}@example.test`,
        category: 'tech',
        password: 'Secret123!',
        sendInvite: true,
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /admin/jobs?moderationQueue=true', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/jobs')
      .query({ moderationQueue: 'true', limit: 5 })
      .set(bearer());
    expect(res.status).toBe(200);
    const payload = data(res.body) as { items: unknown[] };
    expect(Array.isArray(payload.items)).toBe(true);
  });

  it('GET /admin/documents?unresolved=true', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/documents')
      .query({ unresolved: 'true', limit: 5 })
      .set(bearer());
    expect(res.status).toBe(200);
    const payload = data(res.body) as { items: unknown[] };
    expect(Array.isArray(payload.items)).toBe(true);
  });

  it('GET /admin/audit-logs — entityLabel field', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .query({ limit: 5 })
      .set(bearer());
    expect(res.status).toBe(200);
    const payload = data(res.body) as {
      items: Array<Record<string, unknown>>;
    };
    expect(Array.isArray(payload.items)).toBe(true);
    if (payload.items.length > 0) {
      expect(payload.items[0]).toHaveProperty('entityLabel');
      expect(payload.items[0]).toHaveProperty('scope');
    }
  });
});
