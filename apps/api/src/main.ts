import './instrument';

import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { auditLogMiddleware } from './common/middleware/audit-log.middleware';
import { rateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { securityHeadersMiddleware } from './common/middleware/security-headers.middleware';

function getCorsOrigins() {
  const rawOrigins = [process.env.CORS_ORIGIN, process.env.FRONTEND_URL]
    .filter(Boolean)
    .flatMap((val) => val!.split(','))
    .map((origin) => origin.trim())
    .filter(Boolean);

  const configuredOrigins = Array.from(new Set(rawOrigins));

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  configureTrustProxy(app, logger);

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

function configureTrustProxy(app: INestApplication, logger: Logger) {
  const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
  if (trustProxy === undefined) return;

  const expressApp = app.getHttpAdapter().getInstance() as {
    set?: (key: string, value: boolean | number | string) => void;
  };
  expressApp.set?.('trust proxy', trustProxy);
  logger.log(`Express trust proxy configured: ${String(trustProxy)}`);
}

function parseTrustProxy(value?: string) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return normalized;
}
