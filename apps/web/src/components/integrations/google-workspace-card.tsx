'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCalendarConnectUrl } from '@/features/google-calendar/google-calendar-api';
import { isSafeRedirectUrl } from '@/features/google-calendar/google-calendar-utils';
import { useGoogleCalendarIntegration } from '@/features/google-calendar/use-google-calendar';
import { useGoogleContactsIntegration } from '@/features/google-contacts/use-google-contacts';
import { useGoogleDriveIntegration } from '@/features/google-drive/use-google-drive';
import type { IndexingStatus } from '@/lib/api-client';

type GoogleWorkspaceCardProps = {
  indexingStatus?: IndexingStatus | null;
};

type WorkspaceSource = 'calendar' | 'contact' | 'drive' | 'gmail';

type WorkspaceRow = {
  source: WorkspaceSource;
  label: string;
  description: string;
  countLabel: string;
  lastSyncedAt: string | null;
  connected: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  isFuture?: boolean;
  accent: 'sky' | 'fuchsia' | 'lime' | 'slate';
  onSync?: () => void;
};

const accentStyles = {
  sky: {
    dot: 'bg-sky-500',
    button: 'bg-sky-600 text-white hover:bg-sky-700',
    subtle: 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800',
  },
  fuchsia: {
    dot: 'bg-fuchsia-500',
    button: 'bg-fuchsia-600 text-white hover:bg-fuchsia-700',
    subtle: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:ring-fuchsia-800',
  },
  lime: {
    dot: 'bg-lime-500',
    button: 'bg-lime-600 text-white hover:bg-lime-700',
    subtle: 'bg-lime-50 text-lime-700 ring-lime-100 dark:bg-lime-950/40 dark:text-lime-200 dark:ring-lime-800',
  },
  slate: {
    dot: 'bg-slate-400',
    button: 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
    subtle: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  },
};

export function GoogleWorkspaceCard({ indexingStatus }: GoogleWorkspaceCardProps) {
  const auth = useAuth();
  const { isAuthenticated, getAccessToken } = auth;
  const [isConnecting, setIsConnecting] = useState(false);
  const calendar = useGoogleCalendarIntegration(auth);
  const contacts = useGoogleContactsIntegration(auth);
  const drive = useGoogleDriveIntegration(auth);

  const connected =
    Boolean(calendar.status?.connected) ||
    Boolean(contacts.status?.connected) ||
    Boolean(drive.status?.connected);

  const rows: WorkspaceRow[] = useMemo(() => [
    {
      source: 'calendar',
      label: 'Calendar',
      description: 'Events, meetings, and diary links',
      countLabel: `${calendar.status?.eventCount ?? 0} events`,
      lastSyncedAt: calendar.status?.lastSyncedAt ?? null,
      connected: Boolean(calendar.status?.connected),
      isLoading: calendar.isLoading,
      isSyncing: calendar.isSyncing,
      accent: 'sky',
      onSync: () => void calendar.syncCalendar(),
    },
    {
      source: 'contact',
      label: 'Contacts',
      description: 'People, emails, phones, and organizations',
      countLabel: `${contacts.status?.contactCount ?? 0} contacts`,
      lastSyncedAt: contacts.status?.lastSyncedAt ?? null,
      connected: Boolean(contacts.status?.connected),
      isLoading: contacts.isLoading,
      isSyncing: contacts.isSyncing,
      accent: 'fuchsia',
      onSync: () => void contacts.syncGoogleContacts(50),
    },
    {
      source: 'drive',
      label: 'Drive',
      description: 'Files indexed as memory sources',
      countLabel: `${drive.status?.fileCount ?? 0} files`,
      lastSyncedAt: drive.status?.lastSyncedAt ?? null,
      connected: Boolean(drive.status?.connected),
      isLoading: drive.isLoading,
      isSyncing: drive.isSyncing,
      accent: 'lime',
      onSync: () => void drive.syncGoogleDrive(20),
    },
    {
      source: 'gmail',
      label: 'Gmail',
      description: 'Email memory and thread citations',
      countLabel: 'Future',
      lastSyncedAt: null,
      connected: false,
      isLoading: false,
      isSyncing: false,
      isFuture: true,
      accent: 'slate',
    },
  ], [calendar, contacts, drive]);

  const reconnectGoogle = async () => {
    setIsConnecting(true);
    clearFeedback();
    try {
      const url = await fetchCalendarConnectUrl(getAccessToken());
      if (!isSafeRedirectUrl(url)) {
        throw new Error('Received an invalid redirect URL from the server.');
      }
      window.location.href = url;
    } catch {
      setIsConnecting(false);
    }
  };

  const clearFeedback = () => {
    calendar.clearFeedback();
    contacts.clearFeedback();
    drive.clearFeedback();
  };

  const feedback = calendar.feedback ?? contacts.feedback ?? drive.feedback;

  if (!isAuthenticated) {
    return (
      <section id="google-workspace" className="scroll-mt-24 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-900/40">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Integrations
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">
            Google Workspace
          </h3>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-600">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
            Sign in to connect Google Workspace.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="google-workspace" className="scroll-mt-24 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-900/40">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Integrations
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">
            Google Workspace
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Calendar, Contacts, and Drive feed grounded AI memory citations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
            connected
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800'
              : 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800'
          }`}>
            {connected ? 'Connected' : 'Needs reconnect'}
          </span>
          <button
            type="button"
            onClick={() => void reconnectGoogle()}
            disabled={isConnecting}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            {isConnecting ? 'Connecting...' : 'Reconnect Google'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="mb-4 flex items-start justify-between gap-3">
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

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        {rows.map((row) => (
          <WorkspaceIntegrationRow
            key={row.source}
            row={row}
            indexingLabel={getIndexingLabel(row.source, indexingStatus)}
          />
        ))}
      </div>
    </section>
  );
}

function WorkspaceIntegrationRow({
  row,
  indexingLabel,
}: {
  row: WorkspaceRow;
  indexingLabel: string;
}) {
  const styles = accentStyles[row.accent];
  const statusLabel = row.isFuture
    ? 'Future'
    : row.isLoading
      ? 'Checking'
      : row.connected
        ? 'Ready'
        : 'Needs reconnect';

  return (
    <div className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_120px_140px_150px_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} aria-hidden />
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
            {row.label}
          </p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${styles.subtle}`}>
            {statusLabel}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
          {row.description}
        </p>
      </div>

      <Metric label="Synced" value={row.countLabel} />
      <Metric label="Last sync" value={formatLastSynced(row.lastSyncedAt, row.isFuture)} />
      <Metric label="Indexing" value={row.isFuture ? 'Planned' : indexingLabel} />

      <div className="flex justify-start md:justify-end">
        <button
          type="button"
          onClick={row.onSync}
          disabled={row.isFuture || !row.connected || row.isSyncing}
          className={`min-w-24 cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${row.isFuture ? accentStyles.slate.button : styles.button}`}
        >
          {row.isFuture ? 'Future' : row.isSyncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
        {value}
      </p>
    </div>
  );
}

function formatLastSynced(value: string | null, isFuture?: boolean) {
  if (isFuture) return 'Future';
  if (!value) return 'Not synced';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getIndexingLabel(source: WorkspaceSource, indexingStatus?: IndexingStatus | null) {
  if (!indexingStatus?.available) return 'Unknown';
  if (source === 'gmail') return 'Planned';

  const sourceJobs = indexingStatus.recent.filter((job) => job.sourceType === source);
  const activeJob = sourceJobs.find((job) => ['pending', 'retry', 'processing'].includes(job.status));
  if (activeJob) return activeJob.status.replaceAll('_', ' ');

  const failedJob = sourceJobs.find((job) => ['dead_letter', 'failed'].includes(job.status));
  if (failedJob) return failedJob.status.replaceAll('_', ' ');

  return 'Ready';
}
