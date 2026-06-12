import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const WORKER_ID =
  process.env.JOBALLA_WORKER_IDENTIFIER?.trim() || 'fabricemokfembam@gmail.com';
const WORKER_PASSWORD =
  process.env.JOBALLA_WORKER_PASSWORD?.trim() || 'Thiago+123';

describe('Worker routes — May 2026 (e2e)', () => {
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

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: WORKER_ID, password: WORKER_PASSWORD });

    if (login.status !== 200 || !login.body.accessToken) {
      throw new Error(
        `Worker login failed (${login.status}): ${JSON.stringify(login.body)}`,
      );
    }
    accessToken = login.body.accessToken;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  const bearer = () => ({ Authorization: `Bearer ${accessToken}` });

  it('GET /api/worker/me — profileStrengthBreakdown + profileViews', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worker/me')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(res.body.workerProfile.profileStrengthBreakdown).toBeDefined();
    expect(typeof res.body.workerProfile.profileViews).toBe('number');
  });

  it('GET /api/worker/profile — WorkerFullProfile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worker/profile')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(Array.isArray(res.body.paymentAccounts)).toBe(true);
  });

  it('PUT /api/worker/profile', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/worker/profile')
      .set(bearer())
      .send({ city: 'Buea', skills: ['React', 'TypeScript'] });
    expect(res.status).toBe(200);
    expect(res.body.skills).toEqual(
      expect.arrayContaining(['React', 'TypeScript']),
    );
  });

  it('GET /api/worker/dashboard', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worker/dashboard')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(res.body.greeting).toBeDefined();
    expect(res.body.stats).toBeDefined();
  });

  it('GET /api/worker/jobs', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worker/jobs')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/worker/jobs/applications', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worker/jobs/applications')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/worker/notifications', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worker/notifications')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/jobs — normalized job card', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/jobs?page=1&limit=3')
      .set(bearer());
    expect(res.status).toBe(200);
    const first = res.body.items?.[0];
    expect(first).toBeDefined();
    expect(first).toHaveProperty('slug');
    expect(first).toHaveProperty('companyName');
    expect(first).toHaveProperty('hasApplied');
    expect(first).toHaveProperty('saved');
  });

  it('GET /api/earnings/transactions/:id when a payment exists', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/earnings/transactions?limit=1')
      .set(bearer());
    const id = list.body.items?.[0]?.id;
    if (!id) {
      return;
    }
    const res = await request(app.getHttpServer())
      .get(`/api/earnings/transactions/${id}`)
      .set(bearer());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });
});
