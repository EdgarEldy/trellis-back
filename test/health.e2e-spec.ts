import { Test, TestingModule } from '@nestjs/testing';
import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { HealthController } from '../src/health/health.controller';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { createValidationPipe } from '../src/common/pipes/create-validation-pipe';

class ProbeDto {
  @IsString()
  @IsNotEmpty()
  requiredField: string;
}

@Controller('probe')
class ProbeController {
  @Post()
  handle(@Body() _dto: ProbeDto): { ok: boolean } {
    return { ok: true };
  }
}

describe('Bootstrap (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController, ProbeController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 { status: "ok" }', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /unknown-route returns 404 with the standard error shape', async () => {
    const res = await request(app.getHttpServer()).get('/unknown-route').expect(404);
    expect(res.body).toEqual({
      statusCode: 404,
      message: expect.any(String),
      error: expect.any(String),
    });
  });

  it('a request with an invalid body returns 400 with a single string message, not an array', async () => {
    const res = await request(app.getHttpServer()).post('/probe').send({}).expect(400);
    expect(typeof res.body.message).toBe('string');
  });
});
