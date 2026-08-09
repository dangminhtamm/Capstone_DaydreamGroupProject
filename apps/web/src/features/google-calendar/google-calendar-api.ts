import type {
  CalendarConnectionStatus,
  CalendarEvent,
  CalendarSyncResult,
  CalendarError,
  CalendarErrorKind,
} from './google-calendar-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const error = await response.json();
    const message = error?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    return fallback || `HTTP ${response.status}`;
  } catch {
    return fallback || `HTTP ${response.status}`;
  }
}

function classifyError(status: number, message: string): CalendarError {
  let kind: CalendarErrorKind = 'unknown';

  if (status === 401) {
    kind = 'not_authenticated';
  } else if (status === 403) {
    kind = 'not_connected';
  } else if (status === 0 || status >= 500) {
    kind = 'backend_unavailable';
  }

  return { kind, message };
}

function authFetch(endpoint: string, options: RequestInit, accessToken: string | null): Promise<Response> {
  if (!accessToken) {
    return Promise.reject({
      kind: 'not_authenticated',
      message: 'Your session has expired. Please sign in again.',
    } satisfies CalendarError);
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    Authorization: `Bearer ${accessToken}`,
    ...options.headers,
  };

  return fetch(`${API_URL}${endpoint}`, { ...options, headers });
}

export async function fetchCalendarStatus(accessToken: string | null): Promise<CalendarConnectionStatus> {
  const response = await authFetch('/api/calendar/status', { method: 'GET' }, accessToken);

  if (!response.ok) {
    const message = await readApiError(response, 'Failed to fetch calendar status');
    throw classifyError(response.status, message);
  }

  return response.json();
}

export async function fetchCalendarEvents(accessToken: string | null): Promise<CalendarEvent[]> {
  const response = await authFetch('/api/calendar/events', { method: 'GET' }, accessToken);

  if (!response.ok) {
    const message = await readApiError(response, 'Failed to fetch calendar events');
    throw classifyError(response.status, message);
  }

  const data = await response.json() as {
    events?: Array<{
      id: string;
      title: string;
      description?: string | null;
      start_time: string;
      end_time: string;
      html_link?: string | null;
    }>;
  };

  return (data.events ?? []).map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description ?? null,
    startTime: event.start_time,
    endTime: event.end_time,
    htmlLink: event.html_link ?? null,
  }));
}

export async function fetchCalendarConnectUrl(accessToken: string | null): Promise<string> {
  const response = await authFetch('/api/calendar/connect', { method: 'GET' }, accessToken);

  if (!response.ok) {
    const message = await readApiError(response, 'Failed to start Google Calendar connection');
    throw classifyError(response.status, message);
  }

  const data = await response.json() as { url?: string };
  if (!data.url) {
    throw { kind: 'unknown' as CalendarErrorKind, message: 'Backend did not return a Google Calendar connect URL' } as CalendarError;
  }

  return data.url;
}

export async function syncCalendar(accessToken: string | null, limit?: number): Promise<CalendarSyncResult> {
  const query = limit ? `?${new URLSearchParams({ limit: String(limit) })}` : '';
  const response = await authFetch(`/api/calendar/sync${query}`, { method: 'POST' }, accessToken);

  if (!response.ok) {
    const message = await readApiError(response, 'Failed to sync Google Calendar');
    throw classifyError(response.status, message);
  }

  return response.json();
}

function isCalendarError(error: unknown): error is CalendarError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    'message' in error
  );
}

export function toCalendarError(error: unknown, fallback: string): CalendarError {
  if (isCalendarError(error)) return error;
  if (error instanceof Error) {
    return { kind: 'unknown', message: error.message };
  }
  return { kind: 'unknown', message: fallback };
}
