import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { auditLogMiddleware } from './common/middleware/audit-log.middleware';
import { rateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { securityHeadersMiddleware } from './common/middleware/security-headers.middleware';

function getCorsOrigins() {
  const configuredOrigins = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins?.length) {
    return configuredOrigins;
  }

  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');
  app.use(requestIdMiddleware);
  app.use(securityHeadersMiddleware);
  app.use(auditLogMiddleware);
  app.use(rateLimitMiddleware);

  app.enableCors({
    origin: getCorsOrigins(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`API server running on http://localhost:${port}/api`);
}
bootstrap();
