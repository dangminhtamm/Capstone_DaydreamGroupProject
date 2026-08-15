type JobDurationMetric = {
  count: number;
  last: number;
  sum: number;
  avg: number;
  max: number;
};

export type WorkerMetricsSnapshot = {
  jobs_claimed_total: number;
  jobs_succeeded_total: number;
  jobs_failed_total: number;
  jobs_dead_letter_total: number;
  job_duration_ms: JobDurationMetric;
};

export const WORKER_METRICS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

function numberValue(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function metric(name: string, value: number) {
  return `${name} ${numberValue(value)}`;
}

export function renderWorkerMetrics(
  snapshot: WorkerMetricsSnapshot,
  runtime: { uptimeSeconds?: number; nowMs?: number } = {},
) {
  const nowMs = runtime.nowMs ?? Date.now();
  const uptimeSeconds = runtime.uptimeSeconds ?? process.uptime();
  const processStartTimeSeconds = Math.max(0, Math.floor((nowMs / 1000) - uptimeSeconds));
  const duration = snapshot.job_duration_ms;

  return [
    '# HELP worker_process_uptime_seconds Seconds since this worker process started.',
    '# TYPE worker_process_uptime_seconds gauge',
    metric('worker_process_uptime_seconds', uptimeSeconds),
    '# HELP worker_process_start_time_seconds Unix timestamp when this worker process started.',
    '# TYPE worker_process_start_time_seconds gauge',
    metric('worker_process_start_time_seconds', processStartTimeSeconds),
    '# HELP worker_jobs_claimed_total Total indexing jobs claimed by this worker process.',
    '# TYPE worker_jobs_claimed_total counter',
    metric('worker_jobs_claimed_total', snapshot.jobs_claimed_total),
    '# HELP worker_jobs_succeeded_total Total indexing jobs completed successfully by this worker process.',
    '# TYPE worker_jobs_succeeded_total counter',
    metric('worker_jobs_succeeded_total', snapshot.jobs_succeeded_total),
    '# HELP worker_jobs_failed_total Total indexing job attempts that failed in this worker process.',
    '# TYPE worker_jobs_failed_total counter',
    metric('worker_jobs_failed_total', snapshot.jobs_failed_total),
    '# HELP worker_jobs_dead_letter_total Total indexing jobs moved to dead letter by this worker process.',
    '# TYPE worker_jobs_dead_letter_total counter',
    metric('worker_jobs_dead_letter_total', snapshot.jobs_dead_letter_total),
    '# HELP worker_job_duration_ms Processing duration for indexing jobs in milliseconds.',
    '# TYPE worker_job_duration_ms summary',
    metric('worker_job_duration_ms_count', duration.count),
    metric('worker_job_duration_ms_sum', duration.sum),
    '# HELP worker_job_duration_ms_last Last indexing job processing duration in milliseconds.',
    '# TYPE worker_job_duration_ms_last gauge',
    metric('worker_job_duration_ms_last', duration.last),
    '# HELP worker_job_duration_ms_avg Average indexing job processing duration in milliseconds.',
    '# TYPE worker_job_duration_ms_avg gauge',
    metric('worker_job_duration_ms_avg', duration.avg),
    '# HELP worker_job_duration_ms_max Maximum indexing job processing duration in milliseconds.',
    '# TYPE worker_job_duration_ms_max gauge',
    metric('worker_job_duration_ms_max', duration.max),
    '',
  ].join('\n');
}
