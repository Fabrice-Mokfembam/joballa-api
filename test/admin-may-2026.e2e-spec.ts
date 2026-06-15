import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createNestTestApp } from './helpers/create-nest-app';
import { bootstrapAdminAccessToken } from './helpers/bootstrap-e2e-session';
import { unwrapAdmin } from './helpers/v2-response';

describe('Admin v2 routes (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;

  beforeAll(async () => {
    app = await createNestTestApp();
    accessToken = await bootstrapAdminAccessToken(app);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  const bearer = () => ({ Authorization: `Bearer ${accessToken}` });

  it('GET /admin/me', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/me')
      .set(bearer());
    expect(res.status).toBe(200);
    const me = unwrapAdmin<{ session: Record<string, unknown> }>(res.body);
    expect(me.session.permissions).toBeDefined();
    expect(me.session).not.toHaveProperty('departmentId');
  });

  it('GET /admin/dashboard', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set(bearer());
    expect(res.status).toBe(200);
    unwrapAdmin(res.body);
  });

  it('GET /admin/admins', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/admins?limit=5')
      .set(bearer());
    expect(res.status).toBe(200);
    const items = unwrapAdmin<unknown[]>(res.body);
    expect(Array.isArray(items)).toBe(true);
  });

  it('GET /admin/departments', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/departments?limit=5')
      .set(bearer());
    expect(res.status).toBe(200);
    const items = unwrapAdmin<unknown[]>(res.body);
    expect(Array.isArray(items)).toBe(true);
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

  it('GET /admin/jobs/pending', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/jobs/pending?limit=5')
      .set(bearer());
    expect(res.status).toBe(200);
    const items = unwrapAdmin<unknown[]>(res.body);
    expect(Array.isArray(items)).toBe(true);
  });

  it('GET /admin/documents', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/documents?limit=5')
      .set(bearer());
    expect(res.status).toBe(200);
    const items = unwrapAdmin<unknown[]>(res.body);
    expect(Array.isArray(items)).toBe(true);
  });

  it('GET /admin/logs', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/logs?limit=5')
      .set(bearer());
    expect(res.status).toBe(200);
    const items = unwrapAdmin<unknown[]>(res.body);
    expect(Array.isArray(items)).toBe(true);
  });
});
