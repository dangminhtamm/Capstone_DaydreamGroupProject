import type { CalendarEvent, CalendarFeedback } from './google-calendar-types';

export function formatCalendarEventTime(event: CalendarEvent): string {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);

  return `${start.toLocaleString()} - ${end.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function formatLastSynced(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return 'Not synced yet';
  return new Date(lastSyncedAt).toLocaleString();
}

export function isSafeRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'accounts.google.com' || parsed.hostname.endsWith('.accounts.google.com'))
    );
  } catch {
    return false;
  }
}

export function parseCalendarCallbackParams(searchParams: URLSearchParams): {
  result: 'connected' | 'error' | null;
  reason: string | null;
} {
  const calendar = searchParams.get('calendar');
  if (!calendar) return { result: null, reason: null };

  if (calendar === 'connected') {
    return { result: 'connected', reason: null };
  }

  return { result: 'error', reason: searchParams.get('reason') };
}

export function buildCalendarFeedback(
  result: 'connected' | 'error',
  reason: string | null,
): CalendarFeedback {
  if (result === 'connected') {
    return { type: 'success', text: 'Google Calendar connected successfully.' };
  }

  if (reason === 'access_denied') {
    return { type: 'error', text: 'Google Calendar connection was cancelled.' };
  }

  return { type: 'error', text: 'Google Calendar connection failed.' };
}

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}
