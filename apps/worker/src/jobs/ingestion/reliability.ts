export type FailureTransition = {
  retryCount: number;
  status: 'retry' | 'dead_letter';
  runAfter: Date;
};

export function calculateFailureTransition(input: {
  retryCount: number;
  maxRetries: number;
  requiresReconnect: boolean;
  now?: Date;
  baseDelayMs?: number;
  maxDelayMs?: number;
}): FailureTransition {
  const retryCount = input.retryCount + 1;
  const exhausted = input.requiresReconnect || retryCount >= input.maxRetries;
  const now = input.now ?? new Date();

  if (exhausted) {
    return { retryCount, status: 'dead_letter', runAfter: now };
  }

  const baseDelayMs = Math.max(1_000, input.baseDelayMs ?? 30_000);
  const maxDelayMs = Math.max(baseDelayMs, input.maxDelayMs ?? 15 * 60_000);
  const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, retryCount - 1));

  return {
    retryCount,
    status: 'retry',
    runAfter: new Date(now.getTime() + delayMs),
  };
}

export function calculateReconnectDelayMs(
  attempt: number,
  options: { baseDelayMs?: number; maxDelayMs?: number; jitterRatio?: number; random?: () => number } = {},
) {
  const baseDelayMs = Math.max(250, options.baseDelayMs ?? 1_000);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 60_000);
  const jitterRatio = Math.min(Math.max(options.jitterRatio ?? 0.2, 0), 1);
  const random = options.random ?? Math.random;
  const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt));
  const jitter = exponentialDelay * jitterRatio * (random() * 2 - 1);

  return Math.max(250, Math.round(exponentialDelay + jitter));
}

export class SingleFlight<T> {
  private active: Promise<T> | null = null;

  run(task: () => Promise<T>): Promise<T> {
    if (this.active) return this.active;

    const active = Promise.resolve().then(task);
    this.active = active;
    void active.finally(() => {
      if (this.active === active) this.active = null;
    }).catch(() => undefined);
    return active;
  }

  get running() {
    return this.active !== null;
  }
}
