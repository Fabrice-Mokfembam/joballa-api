import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createNestTestApp } from './helpers/create-nest-app';

const FIXED_OTP = process.env.JOBALLA_DEV_FIXED_OTP ?? '555555';

describe('Platform auth (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = `${Date.now()}`;
  const email = `jest-auth-${suffix}@example.test`.toLowerCase();
  const password = `TestPass99!${suffix.slice(-6)}`;

  beforeAll(async () => {
    app = await createNestTestApp();

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
        `Register failed (${register.status}): ${JSON.stringify(register.body)}`,
      );
    }

    const verify = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ identifier: email, otp: FIXED_OTP });

    if (verify.status !== 201) {
      throw new Error(
        `Verify failed (${verify.status}): ${JSON.stringify(verify.body)}`,
      );
    }
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('POST /auth/register — rejects duplicate identifier', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        role: 'WORKER',
        preferredLanguage: 'EN',
      });

    expect(res.status).toBe(409);
  });

  it('POST /auth/verify — rejects wrong OTP for unknown identifier', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({
        identifier: `nobody-${suffix}@example.test`,
        otp: '000000',
      });

    expect(res.status).toBe(400);
  });

  it('POST /auth/login — returns tokens for verified user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: email, password });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.role?.toUpperCase()).toBe('WORKER');
  });

  it('POST /auth/login — rejects wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: email, password: 'wrong-password-xyz' });

    expect(res.status).toBe(401);
  });

  it('GET /auth/me — returns profile with valid access token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: email, password });

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set({ Authorization: `Bearer ${login.body.accessToken}` });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it('POST /auth/refresh — rotates tokens', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: email, password });

    const refreshToken = login.body.refreshToken as string;

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('POST /auth/logout — invalidates session', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: email, password });

    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set({ Authorization: `Bearer ${login.body.accessToken}` })
      .send({ refreshToken: login.body.refreshToken });

    expect(res.status).toBe(200);
  });

  it('GET / — health terminal page', async () => {
    const res = await request(app.getHttpServer()).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Joballa Backend Terminal');
  });
});
