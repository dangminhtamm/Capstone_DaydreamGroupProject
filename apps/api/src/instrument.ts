import './env';

// Sentry is optional — only initialize if both the DSN and package are available.
const sentryDsn = process.env.SENTRY_DSN;

if (sentryDsn) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/nestjs');
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
      release: process.env.SENTRY_RELEASE,
      tracesSampleRate: readSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
    });
  } catch {
    // @sentry/nestjs is not installed — skip silently.
  }
}

function readSampleRate(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(Math.max(parsed, 0), 1);
}
