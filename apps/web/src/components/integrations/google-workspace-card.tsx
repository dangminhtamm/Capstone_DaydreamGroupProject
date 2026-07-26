'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCalendarConnectUrl } from '@/features/google-calendar/google-calendar-api';
import { isSafeRedirectUrl } from '@/features/google-calendar/google-calendar-utils';
import { useGoogleCalendarIntegration } from '@/features/google-calendar/use-google-calendar';
import { useGoogleContactsIntegration } from '@/features/google-contacts/use-google-contacts';
import { useGoogleDriveIntegration } from '@/features/google-drive/use-google-drive';
import { useGoogleGmailIntegration } from '@/features/google-gmail/use-google-gmail';
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
  accent: 'sky' | 'fuchsia' | 'lime' | 'rose';
  onSync?: () => void;
};

const accentStyles = {
  sky: {
    dot: 'bg-sky-500',
    button: 'action-primary',
    subtle: 'status-badge',
  },
  fuchsia: {
    dot: 'bg-fuchsia-500',
    button: 'action-primary',
    subtle: 'status-badge',
  },
  lime: {
    dot: 'bg-lime-500',
    button: 'action-primary',
    subtle: 'status-badge',
  },
  rose: {
    dot: 'bg-rose-500',
    button: 'action-primary',
    subtle: 'status-badge',
  },
};

export function GoogleWorkspaceCard({ indexingStatus }: GoogleWorkspaceCardProps) {
  const auth = useAuth();
  const { isAuthenticated, getAccessToken } = auth;
  const [isConnecting, setIsConnecting] = useState(false);
  const calendar = useGoogleCalendarIntegration(auth);
  const contacts = useGoogleContactsIntegration(auth);
  const drive = useGoogleDriveIntegration(auth);
  const gmail = useGoogleGmailIntegration(auth);

  const connected =
    Boolean(calendar.status?.connected) ||
    Boolean(contacts.status?.connected) ||
    Boolean(drive.status?.connected) ||
    Boolean(gmail.status?.connected);

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
      countLabel: `${gmail.status?.messageCount ?? 0} messages`,
      lastSyncedAt: gmail.status?.lastSyncedAt ?? null,
      connected: Boolean(gmail.status?.connected),
      isLoading: gmail.isLoading,
      isSyncing: gmail.isSyncing,
      accent: 'rose',
      onSync: () => void gmail.syncGmail(20),
    },
  ], [calendar, contacts, drive, gmail]);

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
    gmail.clearFeedback();
  };

  const feedback = calendar.feedback ?? contacts.feedback ?? drive.feedback ?? gmail.feedback;

  if (!isAuthenticated) {
    return (
      <section id="google-workspace" className="scroll-mt-24 enterprise-card p-5">
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Integrations
          </p>
          <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
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
    <section id="google-workspace" className="scroll-mt-24 enterprise-card p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Integrations
          </p>
          <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            Google Workspace
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Calendar, Contacts, Drive, and Gmail feed grounded AI memory citations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`status-badge ${
            connected
              ? 'status-badge-success'
              : 'status-badge-warning'
          }`}>
            {connected ? 'Connected' : 'Needs reconnect'}
          </span>
          <button
            type="button"
            onClick={() => void reconnectGoogle()}
            disabled={isConnecting}
            className="action-secondary disabled:cursor-not-allowed"
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

      <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
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
  const statusLabel = row.isLoading
    ? 'Checking'
    : row.connected
      ? 'Ready'
      : 'Needs reconnect';

  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_120px_140px_150px_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} aria-hidden />
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
            {row.label}
          </p>
          <span className={styles.subtle}>
            {statusLabel}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
          {row.description}
        </p>
      </div>

      <Metric label="Synced" value={row.countLabel} />
      <Metric label="Last sync" value={formatLastSynced(row.lastSyncedAt)} />
      <Metric label="Indexing" value={indexingLabel} />

      <div className="flex justify-start md:justify-end">
        <button
          type="button"
          onClick={row.onSync}
          disabled={!row.connected || row.isSyncing}
          className={`min-w-28 disabled:cursor-not-allowed ${styles.button}`}
        >
          {row.isSyncing ? 'Syncing...' : 'Sync'}
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

function formatLastSynced(value: string | null) {
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

  const sourceJobs = indexingStatus.recent.filter((job) => job.sourceType === source);
  const activeJob = sourceJobs.find((job) => ['pending', 'retry', 'processing'].includes(job.status));
  if (activeJob) return activeJob.status.replaceAll('_', ' ');

  const failedJob = sourceJobs.find((job) => ['dead_letter', 'failed'].includes(job.status));
  if (failedJob) return failedJob.status.replaceAll('_', ' ');

  return 'Ready';
}
