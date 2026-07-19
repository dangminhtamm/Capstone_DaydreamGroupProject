'use client';

import type { CalendarConnectionStatus } from '@/features/google-calendar/google-calendar-types';
import { formatLastSynced } from '@/features/google-calendar/google-calendar-utils';

type Props = {
  status: CalendarConnectionStatus | null;
  isLoading: boolean;
};

export function CalendarConnectionStatus({ status, isLoading }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Connection</p>
        <p
          className={`mt-1 text-lg font-bold ${
            status?.connected
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-900 dark:text-slate-100'
          }`}
        >
          {isLoading ? 'Checking...' : status?.connected ? 'Connected' : 'Not connected'}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Events in DB</p>
        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
          {status?.eventCount ?? 0}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Last Sync</p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {formatLastSynced(status?.lastSyncedAt ?? null)}
        </p>
      </div>
    </div>
  );
}
