import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatCalendarEventTime,
  formatLastSynced,
  isSafeRedirectUrl,
  parseCalendarCallbackParams,
  buildCalendarFeedback,
} from './google-calendar-utils.ts';
import type { CalendarEvent } from './google-calendar-types.ts';

test('formatCalendarEventTime formats start and end times', () => {
  const event: CalendarEvent = {
    id: '1',
    title: 'Test',
    description: null,
    startTime: '2026-07-19T10:00:00.000Z',
    endTime: '2026-07-19T11:00:00.000Z',
    htmlLink: null,
  };

  const formatted = formatCalendarEventTime(event);
  assert.ok(formatted.includes('2026'));
  assert.ok(formatted.length > 0);
});

test('formatLastSynced returns "Not synced yet" for null', () => {
  assert.equal(formatLastSynced(null), 'Not synced yet');
});

test('formatLastSynced returns formatted date for valid string', () => {
  const result = formatLastSynced('2026-07-19T10:00:00.000Z');
  assert.ok(result.includes('2026'));
});

test('isSafeRedirectUrl returns true for https URLs', () => {
  assert.equal(isSafeRedirectUrl('https://accounts.google.com/auth'), true);
});

test('isSafeRedirectUrl rejects non-Google and insecure URLs', () => {
  assert.equal(isSafeRedirectUrl('http://accounts.google.com/auth'), false);
  assert.equal(isSafeRedirectUrl('https://example.com/auth'), false);
  assert.equal(isSafeRedirectUrl('https://accounts.google.com.evil.test/auth'), false);
});

test('isSafeRedirectUrl returns false for invalid URLs', () => {
  assert.equal(isSafeRedirectUrl('not-a-url'), false);
  assert.equal(isSafeRedirectUrl('javascript:alert(1)'), false);
});

test('parseCalendarCallbackParams returns null when no calendar param', () => {
  const params = new URLSearchParams('');
  const result = parseCalendarCallbackParams(params);
  assert.equal(result.result, null);
  assert.equal(result.reason, null);
  assert.equal(result.source, null);
});

test('parseCalendarCallbackParams detects connected', () => {
  const params = new URLSearchParams('calendar=connected&source=drive');
  const result = parseCalendarCallbackParams(params);
  assert.equal(result.result, 'connected');
  assert.equal(result.reason, null);
  assert.equal(result.source, 'drive');
});

test('parseCalendarCallbackParams detects error with reason', () => {
  const params = new URLSearchParams('calendar=error&reason=access_denied');
  const result = parseCalendarCallbackParams(params);
  assert.equal(result.result, 'error');
  assert.equal(result.reason, 'access_denied');
});

test('parseCalendarCallbackParams detects error without reason', () => {
  const params = new URLSearchParams('calendar=error');
  const result = parseCalendarCallbackParams(params);
  assert.equal(result.result, 'error');
  assert.equal(result.reason, null);
});

test('buildCalendarFeedback returns success for connected', () => {
  const feedback = buildCalendarFeedback('connected', null, 'gmail');
  assert.equal(feedback.type, 'success');
  assert.ok(feedback.text.includes('connected'));
  assert.ok(feedback.text.includes('Gmail'));
});

test('buildCalendarFeedback returns cancel message for access_denied', () => {
  const feedback = buildCalendarFeedback('error', 'access_denied');
  assert.equal(feedback.type, 'error');
  assert.ok(feedback.text.includes('cancelled'));
});

test('buildCalendarFeedback does not expose an unknown callback reason', () => {
  const feedback = buildCalendarFeedback('error', 'callback_failed');
  assert.equal(feedback.type, 'error');
  assert.equal(feedback.text, 'Google Calendar connection failed.');
});

test('buildCalendarFeedback returns generic error for missing reason', () => {
  const feedback = buildCalendarFeedback('error', null);
  assert.equal(feedback.type, 'error');
  assert.ok(feedback.text.includes('failed'));
});
