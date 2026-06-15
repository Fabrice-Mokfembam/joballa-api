import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createNestTestApp } from './helpers/create-nest-app';
import { bootstrapEmployerAccessToken } from './helpers/bootstrap-e2e-session';
import { expectPaginated } from './helpers/v2-response';

describe('Employer v2 routes (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;

  beforeAll(async () => {
    app = await createNestTestApp();
    accessToken = await bootstrapEmployerAccessToken(app);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  const bearer = () => ({ Authorization: `Bearer ${accessToken}` });

  it('GET /employer/me', async () => {
    const res = await request(app.getHttpServer())
      .get('/employer/me')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('employer');
    expect(res.body.employerProfile).toBeDefined();
  });

  it('GET /employer/dashboard', async () => {
    const res = await request(app.getHttpServer())
      .get('/employer/dashboard')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
    expect(Array.isArray(res.body.activeJobs)).toBe(true);
  });

  it('GET /employer/company', async () => {
    const res = await request(app.getHttpServer())
      .get('/employer/company')
      .set(bearer());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tagline');
    expect(res.body).toHaveProperty('verificationStatus');
  });

  it('PATCH /employer/company — tagline', async () => {
    const res = await request(app.getHttpServer())
      .patch('/employer/company')
      .set(bearer())
      .send({ tagline: 'Hiring great talent in Cameroon' });
    expect(res.status).toBe(200);
    expect(res.body.tagline).toBe('Hiring great talent in Cameroon');
  });

  it('GET /employer/notifications', async () => {
    const res = await request(app.getHttpServer())
      .get('/employer/notifications?page=1&limit=5')
      .set(bearer());
    expect(res.status).toBe(200);
    expectPaginated(res.body);
  });

  it('PATCH /employer/settings/notifications', async () => {
    const res = await request(app.getHttpServer())
      .patch('/employer/settings/notifications')
      .set(bearer())
      .send({ applicationUpdates: true, inAppEnabled: false });
    expect(res.status).toBe(200);
    expect(res.body.applicationUpdates).toBe(true);
    expect(res.body.inAppEnabled).toBe(false);
  });

  it('GET /employer/applicants', async () => {
    const res = await request(app.getHttpServer())
      .get('/employer/applicants?page=1&limit=5')
      .set(bearer());
    expect(res.status).toBe(200);
    expectPaginated(res.body);
  });
});
