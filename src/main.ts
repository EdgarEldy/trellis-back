import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createValidationPipe } from './common/pipes/create-validation-pipe';

const INSECURE_JWT_SECRET = 'change-me-in-production';

function assertProductionSecretsAreConfigured(configService: ConfigService): void {
  const nodeEnv = configService.get<string>('app.nodeEnv');
  const jwtSecret = configService.get<string>('jwt.secret');

  if (nodeEnv === 'production' && jwtSecret === INSECURE_JWT_SECRET) {
    throw new Error(
      `Refusing to start with NODE_ENV=production and the placeholder JWT_SECRET ` +
        `('${INSECURE_JWT_SECRET}'). Set a real secret, see .env.example.`,
    );
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  assertProductionSecretsAreConfigured(configService);

  app.use(
    helmet({
      // This API's responses (avatar/post images under /uploads) are meant to be
      // fetched cross-origin by the separately-hosted client apps this API serves.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Trellis API')
    .setDescription('REST API backend for the social_feed_app and pulse-feed-app client tutorials')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  app.useGlobalPipes(createValidationPipe());

  app.useGlobalFilters(new HttpExceptionFilter());

  const port = configService.get<number>('app.port') ?? 3000;

  await app.listen(port);
}

bootstrap();
