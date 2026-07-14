import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const auditLogger = new Logger('AuditLog');

type AuditedRequest = Request & {
  requestId?: string;
  user?: {
    userId?: string;
    sub?: string;
    email?: string;
  };
};

export function auditLogMiddleware(
  req: AuditedRequest,
  res: Response,
  next: NextFunction,
) {
  if (process.env.AUDIT_LOG_ENABLED === 'false') {
    next();
    return;
  }

  const start = performance.now();

  res.on('finish', () => {
    const durationMs = Math.round(performance.now() - start);
    const userId = req.user?.userId ?? req.user?.sub ?? null;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'log';
    const record = {
      requestId: req.requestId ?? null,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
      userId,
      ip: clientIp(req),
    };

    auditLogger[level](JSON.stringify(record));
  });

  next();
}

export function getAuditLogStatus() {
  return {
    enabled: process.env.AUDIT_LOG_ENABLED !== 'false',
    sink: process.env.AUDIT_LOG_SINK || 'stdout',
    piiSafe: true,
  };
}

function clientIp(req: Request) {
  return req.header('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || null;
}
