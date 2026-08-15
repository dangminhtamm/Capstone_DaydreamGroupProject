import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderWorkerMetrics } from './metrics.ts';

test('renderWorkerMetrics emits Prometheus text exposition for worker counters and durations', () => {
  const body = renderWorkerMetrics(
    {
      jobs_claimed_total: 4,
      jobs_succeeded_total: 3,
      jobs_failed_total: 1,
      jobs_dead_letter_total: 1,
      job_duration_ms: {
        count: 4,
        last: 120,
        sum: 960,
        avg: 240,
        max: 400,
      },
    },
    { nowMs: 1_700_000_010_000, uptimeSeconds: 10 },
  );

  assert.match(body, /^# HELP worker_process_uptime_seconds/m);
  assert.match(body, /^# TYPE worker_jobs_claimed_total counter/m);
  assert.match(body, /^worker_jobs_claimed_total 4$/m);
  assert.match(body, /^worker_jobs_succeeded_total 3$/m);
  assert.match(body, /^worker_jobs_failed_total 1$/m);
  assert.match(body, /^worker_jobs_dead_letter_total 1$/m);
  assert.match(body, /^# TYPE worker_job_duration_ms summary$/m);
  assert.match(body, /^worker_job_duration_ms_count 4$/m);
  assert.match(body, /^worker_job_duration_ms_sum 960$/m);
  assert.match(body, /^worker_job_duration_ms_last 120$/m);
  assert.match(body, /^worker_job_duration_ms_avg 240$/m);
  assert.match(body, /^worker_job_duration_ms_max 400$/m);
  assert.match(body, /^worker_process_start_time_seconds 1700000000$/m);
  assert.equal(body.endsWith('\n'), true);
});
