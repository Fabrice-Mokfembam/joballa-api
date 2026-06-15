import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createNestTestApp } from './helpers/create-nest-app';
import { bootstrapWorkerAccessToken } from './helpers/bootstrap-e2e-session';
import { expectPaginated } from './helpers/v2-response';

describe('Worker v2 routes (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;

  beforeAll(async () => {
    app = await createNestTestApp();
    accessToken = await bootstrapWorkerAccessToken(app);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  const bearer = () => ({ Authorization: `Bearer ${accessToken}` });

  it('GET /worker/me', async () => {
    const res = await request(app.getHttpServer())
      .get('/worker/me')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('worker');
    expect(res.body.workerProfile).toBeDefined();
  });

  it('GET /worker/profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/worker/profile')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
  });

  it('PUT /worker/profile', async () => {
    const res = await request(app.getHttpServer())
      .put('/worker/profile')
      .set(bearer())
      .send({ city: 'Buea', skills: ['React', 'TypeScript'] });
    expect(res.status).toBe(200);
    expect(res.body.skills).toEqual(
      expect.arrayContaining(['React', 'TypeScript']),
    );
  });

  it('GET /worker/dashboard', async () => {
    const res = await request(app.getHttpServer())
      .get('/worker/dashboard')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(res.body.welcomeName).toBeDefined();
    expect(res.body.stats).toBeDefined();
  });

  it('GET /worker/jobs', async () => {
    const res = await request(app.getHttpServer())
      .get('/worker/jobs?page=1&limit=5')
      .set(bearer());
    expect(res.status).toBe(200);
    expectPaginated(res.body);
  });

  it('GET /worker/applications', async () => {
    const res = await request(app.getHttpServer())
      .get('/worker/applications?page=1&limit=5')
      .set(bearer());
    expect(res.status).toBe(200);
    expectPaginated(res.body);
  });

  it('GET /worker/notifications', async () => {
    const res = await request(app.getHttpServer())
      .get('/worker/notifications?page=1&limit=5')
      .set(bearer());
    expect(res.status).toBe(200);
    expectPaginated(res.body);
  });

  it('GET /worker/earnings/transactions', async () => {
    const res = await request(app.getHttpServer())
      .get('/worker/earnings/transactions?page=1&limit=5')
      .set(bearer());
    expect(res.status).toBe(200);
    expectPaginated(res.body);
  });
});
