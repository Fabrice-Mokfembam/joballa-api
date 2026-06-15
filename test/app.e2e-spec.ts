import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createNestTestApp } from './helpers/create-nest-app';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createNestTestApp();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('GET / — terminal status page', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Content-Type', /html/)
      .expect((res) => {
        expect(res.text).toContain('<title>Joballa Backend Terminal</title>');
        expect(res.text).toContain('JOBALLA BACKEND ONLINE');
      });
  });
});
