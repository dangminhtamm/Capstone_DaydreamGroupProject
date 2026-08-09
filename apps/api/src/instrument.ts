import './env';

import * as Sentry from '@sentry/nestjs';

const sentryDsn = process.env.SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: readSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
  });
}

function readSampleRate(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(Math.max(parsed, 0), 1);
}
