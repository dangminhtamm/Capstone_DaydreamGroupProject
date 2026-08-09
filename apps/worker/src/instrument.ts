import './env';

// Sentry is optional — only initialize if both the DSN and package are available.
const sentryDsn = process.env.SENTRY_DSN;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sentry: any = null;

if (sentryDsn) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _sentry = require('@sentry/node');
    _sentry.init({
      dsn: sentryDsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
      release: process.env.SENTRY_RELEASE,
      tracesSampleRate: readSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
    });
  } catch {
    // @sentry/node is not installed — skip silently.
  }
}

export async function captureWorkerException(error: unknown) {
  if (!_sentry) return;

  _sentry.captureException(error);
  await _sentry.flush(2000);
}

function readSampleRate(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(Math.max(parsed, 0), 1);
}
