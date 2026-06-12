import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Employer routes — May 2026 (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let applicationId: string | undefined;

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

    const identifier = process.env.JOBALLA_EMPLOYER_IDENTIFIER?.trim();
    const password = process.env.JOBALLA_EMPLOYER_PASSWORD?.trim();

    if (identifier && password) {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier, password });
      if (login.status !== 200 || !login.body.accessToken) {
        throw new Error(
          `Employer login failed (${login.status}): ${JSON.stringify(login.body)}`,
        );
      }
      accessToken = login.body.accessToken;
      return;
    }

    const prisma = app.get(PrismaService);
    const suffix = `${Date.now()}`;
    const testPassword = `EmployerE2e99!${suffix.slice(-4)}`;
    const email = `employer-e2e-${suffix}@example.test`;
    const passwordHash = await bcrypt.hash(testPassword, 12);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'EMPLOYER',
        verificationStatus: 'VERIFIED',
        isActive: true,
        languagePreference: 'EN',
        employerProfile: {
          create: {
            companyName: `E2E Employer ${suffix}`,
            verificationStatus: 'VERIFIED',
          },
        },
      },
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: email, password: testPassword });

    if (login.status !== 200 || !login.body.accessToken) {
      throw new Error(
        `Employer bootstrap login failed (${login.status}): ${JSON.stringify(login.body)}`,
      );
    }
    accessToken = login.body.accessToken;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  const bearer = () => ({ Authorization: `Bearer ${accessToken}` });

  it('GET /api/employer/me', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/employer/me')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(res.body.company).toBeDefined();
  });

  it('GET /api/employer/dashboard', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/employer/dashboard')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(res.body.activeJobs).toBeDefined();
  });

  it('GET /api/employer/company — tagline + counts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/employer/company')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(typeof res.body.applicantsCount).toBe('number');
    expect(typeof res.body.employeesCount).toBe('number');
    expect(res.body).toHaveProperty('tagline');
    expect(res.body).toHaveProperty('verificationStatus');
  });

  it('PATCH /api/employer/company — tagline', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/employer/company')
      .set(bearer())
      .send({ tagline: 'Hiring great talent in Cameroon' });
    expect(res.status).toBe(200);
    expect(res.body.tagline).toBe('Hiring great talent in Cameroon');
  });

  it('GET /api/employer/notifications', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/employer/notifications')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('PATCH /api/employer/settings/notifications', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/employer/settings/notifications')
      .set(bearer())
      .send({ applicantsEnabled: true, pushEnabled: false });
    expect(res.status).toBe(200);
    expect(res.body.applicantsEnabled).toBe(true);
    expect(res.body.pushEnabled).toBe(false);
  });

  it('GET /api/employer/applicants + PATCH notes when application exists', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/employer/applicants')
      .set(bearer());
    expect(list.status).toBe(200);
    applicationId = list.body.items?.[0]?.applicationId;
    if (!applicationId) {
      return;
    }
    const notes = await request(app.getHttpServer())
      .patch(`/api/employer/applicants/${applicationId}/notes`)
      .set(bearer())
      .send({ employerNotes: 'E2E note — strong fit' });
    expect(notes.status).toBe(200);
    expect(notes.body.employerNotes).toContain('E2E note');
  });
});
