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
  source: string | null;
} {
  const calendar = searchParams.get('calendar');
  const source = searchParams.get('source');
  if (!calendar) return { result: null, reason: null, source };

  if (calendar === 'connected') {
    return { result: 'connected', reason: null, source };
  }

  return { result: 'error', reason: searchParams.get('reason'), source };
}

export function buildCalendarFeedback(
  result: 'connected' | 'error',
  reason: string | null,
  source?: string | null,
): CalendarFeedback {
  const sourceLabel = googleSourceLabel(source);
  if (result === 'connected') {
    return { type: 'success', text: `${sourceLabel} connected successfully.` };
  }

  if (reason === 'access_denied') {
    return { type: 'error', text: `${sourceLabel} connection was cancelled.` };
  }

  return { type: 'error', text: `${sourceLabel} connection failed.` };
}

function googleSourceLabel(source?: string | null) {
  switch (source) {
    case 'gmail':
      return 'Gmail';
    case 'drive':
      return 'Google Drive';
    case 'contact':
      return 'Google Contacts';
    case 'all':
      return 'Google Workspace';
    case 'calendar':
    default:
      return 'Google Calendar';
  }
}
