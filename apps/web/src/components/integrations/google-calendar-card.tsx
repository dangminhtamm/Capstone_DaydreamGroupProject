'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useGoogleCalendarIntegration } from '@/features/google-calendar/use-google-calendar';
import { isDemoMode } from '@/features/google-calendar/google-calendar-utils';
import { CalendarConnectionStatus } from './calendar-connection-status';
import { CalendarEventList } from './calendar-event-list';

export function GoogleCalendarCard() {
  const auth = useAuth();
  const { isAuthenticated } = auth;
  const {
    status,
    events,
    isLoading,
    isConnecting,
    isSyncing,
    feedback,
    connectCalendar,
    reconnectCalendar,
    syncCalendar,
    refreshCalendar,
    clearFeedback,
  } = useGoogleCalendarIntegration(auth);

  if (!isAuthenticated) {
    return (
      <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-sky-50/30 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-sky-950/20 dark:shadow-slate-900/40">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
            Integrations
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">
            Google Calendar
          </h3>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-600">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
            Sign in to connect Google Calendar.
          </p>
        </div>
      </section>
    );
  }

  const showDemoButton = isDemoMode();

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-sky-50/30 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-sky-950/20 dark:shadow-slate-900/40">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
          Integrations
        </p>
        <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">
          Google Calendar
        </h3>
      </div>

      <div className="space-y-4">
        <CalendarConnectionStatus status={status} isLoading={isLoading} />

        {feedback && (
          <div className="flex items-start justify-between gap-3">
            <p
              className={`text-sm font-medium ${
                feedback.type === 'success'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
              role={feedback.type === 'error' ? 'alert' : 'status'}
            >
              {feedback.text}
            </p>
            <button
              type="button"
              onClick={clearFeedback}
              className="shrink-0 cursor-pointer text-xs text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
              aria-label="Dismiss message"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={status?.connected ? reconnectCalendar : connectCalendar}
            disabled={isConnecting}
            className="cursor-pointer rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConnecting
              ? 'Connecting...'
              : status?.connected
                ? 'Reconnect Calendar'
                : 'Connect Calendar'}
          </button>
          <button
            type="button"
            onClick={() => void syncCalendar()}
            disabled={!status?.connected || isSyncing}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
          {showDemoButton && (
            <button
              type="button"
              onClick={() => void syncCalendar(3)}
              disabled={!status?.connected || isSyncing}
              className="cursor-pointer rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/50"
            >
              {isSyncing ? 'Syncing...' : 'Sync Demo (3)'}
            </button>
          )}
        </div>

        <CalendarEventList
          events={events}
          status={status}
          isLoading={isLoading}
          onRefresh={refreshCalendar}
        />
      </div>
    </section>
  );
}
