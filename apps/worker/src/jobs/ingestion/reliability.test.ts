import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateFailureTransition,
  calculateReconnectDelayMs,
  SingleFlight,
} from './reliability.ts';

test('failure transition retries with exponential backoff before max retries', () => {
  const now = new Date('2026-08-14T00:00:00.000Z');
  const transition = calculateFailureTransition({
    retryCount: 1,
    maxRetries: 4,
    requiresReconnect: false,
    now,
    baseDelayMs: 1_000,
    maxDelayMs: 60_000,
  });

  assert.deepEqual(transition, {
    retryCount: 2,
    status: 'retry',
    runAfter: new Date('2026-08-14T00:00:02.000Z'),
  });
});

test('failure transition dead-letters exhausted and reconnect-required jobs', () => {
  const now = new Date('2026-08-14T00:00:00.000Z');

  assert.equal(calculateFailureTransition({
    retryCount: 2,
    maxRetries: 3,
    requiresReconnect: false,
    now,
  }).status, 'dead_letter');

  assert.equal(calculateFailureTransition({
    retryCount: 0,
    maxRetries: 3,
    requiresReconnect: true,
    now,
  }).status, 'dead_letter');
});

test('single flight shares one drain across concurrent triggers', async () => {
  const singleFlight = new SingleFlight<number>();
  let calls = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const task = async () => {
    calls += 1;
    await gate;
    return 7;
  };

  const cronDrain = singleFlight.run(task);
  const realtimeDrain = singleFlight.run(task);
  assert.equal(singleFlight.running, true);
  await Promise.resolve();
  assert.equal(calls, 1);

  release?.();
  assert.deepEqual(await Promise.all([cronDrain, realtimeDrain]), [7, 7]);
  assert.equal(calls, 1);

  await singleFlight.run(task);
  assert.equal(calls, 2);
});

test('listener reconnect delay is exponential and capped', () => {
  const options = { baseDelayMs: 1_000, maxDelayMs: 8_000, jitterRatio: 0, random: () => 0.5 };
  assert.equal(calculateReconnectDelayMs(0, options), 1_000);
  assert.equal(calculateReconnectDelayMs(2, options), 4_000);
  assert.equal(calculateReconnectDelayMs(10, options), 8_000);
});
