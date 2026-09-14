import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { createValidationPipe } from '../src/common/pipes/create-validation-pipe';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const uniqueEmail = (): string => `e2e-${randomUUID()}@test.local`;

  const register = (
    email: string,
    password = 'password123',
    displayName = 'E2E User',
  ): request.Test =>
    request(app.getHttpServer()).post('/auth/register').send({ email, password, displayName });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await dataSource.query(
      `DELETE FROM refresh_tokens WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e-%@test.local')`,
    );
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-%@test.local'`);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('creates an account and returns tokens plus the public user shape', async () => {
      const email = uniqueEmail();

      const response = await register(email).expect(201);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.refreshToken).toEqual(expect.any(String));
      expect(response.body.user.email).toBe(email);
      expect(response.body.user.passwordHash).toBeUndefined();
    });
  });

  describe('POST /auth/login', () => {
    it('returns tokens for valid credentials', async () => {
      const email = uniqueEmail();
      await register(email, 'password123');

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'password123' })
        .expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
    });

    it('rejects a wrong password with 401', async () => {
      const email = uniqueEmail();
      await register(email, 'password123');

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);
    });
  });

  describe('protected routes', () => {
    it('allows access to a protected route with a valid access token', async () => {
      const email = uniqueEmail();
      const { body } = await register(email);

      await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .send({ displayName: 'Updated Name' })
        .expect(200);
    });

    it('rejects access to a protected route with no token', async () => {
      await request(app.getHttpServer())
        .patch('/users/me')
        .send({ displayName: 'Updated Name' })
        .expect(401);
    });
  });

  describe('GET /health', () => {
    it('stays public under the real guard stack, no token required', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns a new access token for a valid refresh token', async () => {
      const { body } = await register(uniqueEmail());

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: body.refreshToken })
        .expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
    });

    it('rejects a refresh token that was already revoked by logout', async () => {
      const { body } = await register(uniqueEmail());

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .send({ refreshToken: body.refreshToken })
        .expect(204);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: body.refreshToken })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('responds 204', async () => {
      const { body } = await register(uniqueEmail());

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .send({ refreshToken: body.refreshToken })
        .expect(204);
    });
  });

  describe('POST /users/me/avatar', () => {
    it('rejects a non-image file with 400 before writing anything to disk', async () => {
      const { body } = await register(uniqueEmail());

      await request(app.getHttpServer())
        .post('/users/me/avatar')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .attach('file', Buffer.from('not an image'), {
          filename: 'notes.txt',
          contentType: 'text/plain',
        })
        .expect(400);
    });
  });
});
