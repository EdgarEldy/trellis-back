import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      exceptionFactory: (errors) => {
        const message = errors
          .map((e) => Object.values(e.constraints ?? {}).join(', '))
          .join('; ');
        return new BadRequestException(message);
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 3000;

  await app.listen(port);
}

bootstrap();
