import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Global prefix — all routes become /api/...
  app.setGlobalPrefix('api');

  // Validate and transform all incoming DTOs automatically
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,         // Strip unknown fields from the request body
      forbidNonWhitelisted: true, // Throw 400 if unknown fields are sent
      transform: true,         // Auto-convert query params / body to DTO types
    }),
  );

  // Allow the frontend (any origin in dev) to call this API
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`API server running on http://localhost:${port}/api`);
}

bootstrap();

