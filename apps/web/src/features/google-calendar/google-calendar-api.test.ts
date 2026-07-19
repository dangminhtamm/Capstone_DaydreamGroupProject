import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const originalFetch = globalThis.fetch;
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiUrl === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  }
});

function mockResponse(body: unknown, status = 200, contentType = 'application/json') {
  return new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    { status, headers: { 'Content-Type': contentType } },
  );
}

test('fetchCalendarStatus sends bearer token and returns status', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  const { fetchCalendarStatus } = await import('./google-calendar-api.ts');

  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return mockResponse({ connected: true, eventCount: 5, lastSyncedAt: '2026-07-19T10:00:00.000Z' });
  };

  const result = await fetchCalendarStatus('jwt-token');

  assert.equal(new URL(capturedUrl).pathname, '/api/calendar/status');
  assert.equal(capturedInit?.method, 'GET');
  assert.equal((capturedInit?.headers as Record<string, string>).Authorization, 'Bearer jwt-token');
  assert.equal(result.connected, true);
  assert.equal(result.eventCount, 5);
  assert.equal(result.lastSyncedAt, '2026-07-19T10:00:00.000Z');
});

test('API functions reject before fetch when the access token is missing', async () => {
  const { fetchCalendarStatus } = await import('./google-calendar-api.ts');
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return mockResponse({});
  };

  await assert.rejects(
    () => fetchCalendarStatus(null),
    (err: { kind: string; message: string }) =>
      err.kind === 'not_authenticated' && /sign in again/i.test(err.message),
  );
  assert.equal(fetchCalled, false);
});

test('fetchCalendarEvents maps snake_case to camelCase', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  const { fetchCalendarEvents } = await import('./google-calendar-api.ts');

  globalThis.fetch = async () =>
    mockResponse({
      events: [
        {
          id: 'event-1',
          title: 'Team Meeting',
          description: 'Weekly sync',
          start_time: '2026-07-19T10:00:00.000Z',
          end_time: '2026-07-19T11:00:00.000Z',
          html_link: 'https://calendar.google.com/event-1',
        },
      ],
    });

  const events = await fetchCalendarEvents('jwt-token');

  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'event-1');
  assert.equal(events[0].startTime, '2026-07-19T10:00:00.000Z');
  assert.equal(events[0].endTime, '2026-07-19T11:00:00.000Z');
  assert.equal(events[0].htmlLink, 'https://calendar.google.com/event-1');
  assert.equal(events[0].description, 'Weekly sync');
});

test('fetchCalendarEvents handles null description and missing html_link', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  const { fetchCalendarEvents } = await import('./google-calendar-api.ts');

  globalThis.fetch = async () =>
    mockResponse({
      events: [
        {
          id: 'event-2',
          title: 'No Description',
          start_time: '2026-07-19T10:00:00.000Z',
          end_time: '2026-07-19T11:00:00.000Z',
        },
      ],
    });

  const events = await fetchCalendarEvents('jwt-token');

  assert.equal(events[0].description, null);
  assert.equal(events[0].htmlLink, null);
});

test('fetchCalendarEvents handles empty events array', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  const { fetchCalendarEvents } = await import('./google-calendar-api.ts');

  globalThis.fetch = async () => mockResponse({ events: [] });
  const events = await fetchCalendarEvents('jwt-token');
  assert.equal(events.length, 0);
});

test('fetchCalendarConnectUrl returns the OAuth URL', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  const { fetchCalendarConnectUrl } = await import('./google-calendar-api.ts');

  globalThis.fetch = async () => mockResponse({ url: 'https://accounts.google.com/o/oauth2/auth?scope=calendar' });

  const url = await fetchCalendarConnectUrl('jwt-token');
  assert.equal(url, 'https://accounts.google.com/o/oauth2/auth?scope=calendar');
});

test('fetchCalendarConnectUrl throws when backend does not return url', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  const { fetchCalendarConnectUrl } = await import('./google-calendar-api.ts');

  globalThis.fetch = async () => mockResponse({});

  await assert.rejects(
    () => fetchCalendarConnectUrl('jwt-token'),
    (err: { message: string }) => /connect URL/i.test(err.message),
  );
});

test('syncCalendar sends POST with optional limit query param', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  const { syncCalendar } = await import('./google-calendar-api.ts');

  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return mockResponse({
      message: 'Sync completed',
      syncedCount: 10,
      queuedIndexingJobs: 10,
      linkedDiaryCount: 2,
      linkedEventCount: 2,
      memoryIndexingStatus: 'queued',
    });
  };

  const result = await syncCalendar('jwt-token', 3);

  assert.equal(new URL(capturedUrl).pathname, '/api/calendar/sync');
  assert.equal(new URL(capturedUrl).searchParams.get('limit'), '3');
  assert.equal(capturedInit?.method, 'POST');
  assert.equal(result.syncedCount, 10);
  assert.equal(result.queuedIndexingJobs, 10);
});

test('syncCalendar works without limit param', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  const { syncCalendar } = await import('./google-calendar-api.ts');

  let capturedUrl = '';

  globalThis.fetch = async (input) => {
    capturedUrl = String(input);
    return mockResponse({ message: 'Sync completed', syncedCount: 50 });
  };

  const result = await syncCalendar('jwt-token');
  assert.equal(new URL(capturedUrl).search, '');
  assert.equal(result.syncedCount, 50);
});

test('API functions throw backend error message on non-OK response', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  const { fetchCalendarStatus } = await import('./google-calendar-api.ts');

  globalThis.fetch = async () => mockResponse({ message: 'Unauthorized' }, 401);

  await assert.rejects(
    () => fetchCalendarStatus('bad-token'),
    (err: { message: string }) => /Unauthorized/.test(err.message),
  );
});

test('API functions handle non-JSON error responses', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  const { fetchCalendarStatus } = await import('./google-calendar-api.ts');

  globalThis.fetch = async () =>
    new Response('Internal Server Error', { status: 500, headers: { 'Content-Type': 'text/plain' } });

  await assert.rejects(
    () => fetchCalendarStatus('jwt-token'),
    (err: { message: string }) => /Failed to fetch calendar status/.test(err.message),
  );
});

test('API functions handle array error messages', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  const { syncCalendar } = await import('./google-calendar-api.ts');

  globalThis.fetch = async () =>
    mockResponse({ message: ['Field X is required', 'Field Y is invalid'] }, 400);

  await assert.rejects(
    () => syncCalendar('jwt-token'),
    (err: { message: string }) => /Field X is required, Field Y is invalid/.test(err.message),
  );
});

test('toCalendarError wraps generic Error into CalendarError', async () => {
  const { toCalendarError } = await import('./google-calendar-api.ts');

  const result = toCalendarError(new Error('Something went wrong'), 'Fallback');
  assert.equal(result.kind, 'unknown');
  assert.equal(result.message, 'Something went wrong');
});

test('toCalendarError returns fallback for non-Error values', async () => {
  const { toCalendarError } = await import('./google-calendar-api.ts');

  const result = toCalendarError('string error', 'Fallback message');
  assert.equal(result.kind, 'unknown');
  assert.equal(result.message, 'Fallback message');
});
