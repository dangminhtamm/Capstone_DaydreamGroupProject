'use client';

import type { CalendarEvent, CalendarConnectionStatus } from '@/features/google-calendar/google-calendar-types';
import { formatCalendarEventTime } from '@/features/google-calendar/google-calendar-utils';

type Props = {
  events: CalendarEvent[];
  status: CalendarConnectionStatus | null;
  isLoading: boolean;
  onRefresh: () => void;
};

export function CalendarEventList({ events, status, isLoading, onRefresh }: Props) {
  if (isLoading && events.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Synced Events</p>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-2 h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Synced Events</p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="cursor-pointer text-xs font-semibold text-sky-600 transition hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-400 dark:hover:text-sky-300"
          aria-label="Refresh calendar events"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {events.length > 0 ? (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1" role="list">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40"
              role="listitem"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {event.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {formatCalendarEventTime(event)}
                  </p>
                </div>
                {event.htmlLink && (
                  <a
                    href={event.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    aria-label={`Open "${event.title}" in Google Calendar`}
                  >
                    Open
                  </a>
                )}
              </div>
              {event.description && (
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
                  {event.description}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {!status?.connected
              ? 'Connect Calendar to load events.'
              : 'No synced events yet. Click "Sync Now" to fetch events.'}
          </p>
        </div>
      )}
    </div>
  );
}
