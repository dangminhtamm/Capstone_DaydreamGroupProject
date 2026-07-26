'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCalendarConnectUrl } from '@/features/google-calendar/google-calendar-api';
import { isSafeRedirectUrl } from '@/features/google-calendar/google-calendar-utils';
import { useGoogleCalendarIntegration } from '@/features/google-calendar/use-google-calendar';
import { useGoogleContactsIntegration } from '@/features/google-contacts/use-google-contacts';
import { useGoogleDriveIntegration } from '@/features/google-drive/use-google-drive';
import { useGoogleGmailIntegration } from '@/features/google-gmail/use-google-gmail';
import type { IndexingJobStatus, IndexingStatus } from '@/lib/api-client';

type GoogleWorkspaceCardProps = {
  indexingStatus?: IndexingStatus | null;
};

type WorkspaceSource = 'calendar' | 'contact' | 'drive' | 'gmail';
type SourceTone = 'ready' | 'working' | 'attention' | 'idle';

type SourceFeedback = {
  type: 'success' | 'error';
  text: string;
};

type WorkspaceRow = {
  source: WorkspaceSource;
  label: string;
  description: string;
  valueLabel: string;
  valueCount: number;
  noun: string;
  lastSyncedAt: string | null;
  connected: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  feedback?: SourceFeedback | null;
  examples: string[];
  onImport: () => void;
};

type IndexingInfo = {
  label: string;
  detail?: string;
  tone: SourceTone;
  active: boolean;
  failed: boolean;
};

type SourcePresentation = {
  statusLabel: string;
  statusDetail: string;
  tone: SourceTone;
  buttonLabel: string;
  buttonKind: 'connect' | 'import';
};

const sourceAccent: Record<WorkspaceSource, string> = {
  calendar: 'bg-sky-500',
  contact: 'bg-fuchsia-500',
  drive: 'bg-lime-500',
  gmail: 'bg-rose-500',
};

export function GoogleWorkspaceCard({ indexingStatus }: GoogleWorkspaceCardProps) {
  const auth = useAuth();
  const { isAuthenticated, getAccessToken } = auth;
  const [isConnecting, setIsConnecting] = useState(false);
  const calendar = useGoogleCalendarIntegration(auth);
  const contacts = useGoogleContactsIntegration(auth);
  const drive = useGoogleDriveIntegration(auth);
  const gmail = useGoogleGmailIntegration(auth);

  const rows: WorkspaceRow[] = useMemo(() => [
    {
      source: 'calendar',
      label: 'Calendar',
      description: 'Meetings and events that explain what happened around diary entries.',
      valueLabel: `${calendar.status?.eventCount ?? 0} events`,
      valueCount: calendar.status?.eventCount ?? 0,
      noun: 'events',
      lastSyncedAt: calendar.status?.lastSyncedAt ?? null,
      connected: Boolean(calendar.status?.connected),
      isLoading: calendar.isLoading,
      isSyncing: calendar.isSyncing,
      feedback: calendar.feedback,
      examples: [
        'What meetings were linked to my diary?',
        'What was on my calendar this week?',
      ],
      onImport: () => void calendar.syncCalendar(),
    },
    {
      source: 'gmail',
      label: 'Gmail',
      description: 'Recent emails that can become cited memory for project decisions and feedback.',
      valueLabel: `${gmail.status?.messageCount ?? 0} messages`,
      valueCount: gmail.status?.messageCount ?? 0,
      noun: 'messages',
      lastSyncedAt: gmail.status?.lastSyncedAt ?? null,
      connected: Boolean(gmail.status?.connected),
      isLoading: gmail.isLoading,
      isSyncing: gmail.isSyncing,
      feedback: gmail.feedback,
      examples: [
        'What feedback did Linh send?',
        'Which emails mention the demo?',
      ],
      onImport: () => void gmail.syncGmail(20),
    },
    {
      source: 'drive',
      label: 'Drive',
      description: 'Docs and files that Second Brain can quote when answering questions.',
      valueLabel: `${drive.status?.fileCount ?? 0} files`,
      valueCount: drive.status?.fileCount ?? 0,
      noun: 'files',
      lastSyncedAt: drive.status?.lastSyncedAt ?? null,
      connected: Boolean(drive.status?.connected),
      isLoading: drive.isLoading,
      isSyncing: drive.isSyncing,
      feedback: drive.feedback,
      examples: [
        'What does the demo plan require?',
        'Which document explains MVP scope?',
      ],
      onImport: () => void drive.syncGoogleDrive(20),
    },
    {
      source: 'contact',
      label: 'Contacts',
      description: 'People and organizations that help AI understand names in your memories.',
      valueLabel: `${contacts.status?.contactCount ?? 0} contacts`,
      valueCount: contacts.status?.contactCount ?? 0,
      noun: 'contacts',
      lastSyncedAt: contacts.status?.lastSyncedAt ?? null,
      connected: Boolean(contacts.status?.connected),
      isLoading: contacts.isLoading,
      isSyncing: contacts.isSyncing,
      feedback: contacts.feedback,
      examples: [
        'Who is Linh in my workspace?',
        'Which contacts are related to the project?',
      ],
      onImport: () => void contacts.syncGoogleContacts(50),
    },
  ], [calendar, contacts, drive, gmail]);

  const presentations = useMemo(() => {
    return Object.fromEntries(
      rows.map((row) => [
        row.source,
        getSourcePresentation(row, getIndexingInfo(row.source, indexingStatus)),
      ]),
    ) as Record<WorkspaceSource, SourcePresentation>;
  }, [indexingStatus, rows]);

  const connected = rows.some((row) => row.connected);
  const readyCount = rows.filter((row) => presentations[row.source].tone === 'ready').length;
  const attentionCount = rows.filter((row) => presentations[row.source].tone === 'attention').length;
  const importedCount = rows.reduce((total, row) => total + (row.valueCount > 0 ? 1 : 0), 0);
  const overallTone: SourceTone = attentionCount > 0 ? 'attention' : readyCount > 0 ? 'ready' : connected ? 'working' : 'idle';
  const overallLabel = !connected
    ? 'Connect Google first'
    : attentionCount > 0
      ? `${attentionCount} source${attentionCount === 1 ? '' : 's'} need attention`
      : readyCount > 0
        ? `${readyCount} source${readyCount === 1 ? '' : 's'} ready for AI`
        : 'Import Google data';

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
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Memory sources
          </p>
          <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            Google context for Second Brain
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sign in before connecting Calendar, Gmail, Drive, and Contacts.
          </p>
        </div>
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Sign in to manage Google memory sources.
          </p>
          <a href="/login" className="action-primary mt-4">
            Sign in
          </a>
        </div>
      </section>
    );
  }

  return (
    <section id="google-workspace" className="scroll-mt-24 enterprise-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Memory sources
          </p>
          <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            Google context for Second Brain
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Choose which Google data Second Brain can remember. Imported sources become searchable citations in Ask your Second Brain.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`status-badge ${toneBadgeClass(overallTone)}`}>
            {overallLabel}
          </span>
          <button
            type="button"
            onClick={() => void reconnectGoogle()}
            disabled={isConnecting}
            className="action-secondary disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Opening Google...' : connected ? 'Fix Google access' : 'Connect Google'}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <StepItem
          step="1"
          title="Connect Google"
          description={connected ? 'Google account access is available.' : 'Grant read-only access once.'}
          done={connected}
        />
        <StepItem
          step="2"
          title="Import sources"
          description={importedCount > 0 ? `${importedCount}/4 sources have data.` : 'Pick the sources you want to import.'}
          done={importedCount > 0}
        />
        <StepItem
          step="3"
          title="Ask with citations"
          description={readyCount > 0 ? 'Search can cite ready sources.' : 'Ready sources will appear in AI answers.'}
          done={readyCount > 0}
        />
      </div>

      {feedback && (
        <div className={`mt-4 rounded-xl border p-3 ${
          feedback.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
            : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium" role={feedback.type === 'error' ? 'alert' : 'status'}>
              {feedback.text}
            </p>
            <button
              type="button"
              onClick={clearFeedback}
              className="shrink-0 cursor-pointer text-xs font-semibold opacity-70 transition hover:opacity-100"
              aria-label="Dismiss message"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-3">
        {rows.map((row) => (
          <MemorySourceRow
            key={row.source}
            row={row}
            presentation={presentations[row.source]}
            indexingInfo={getIndexingInfo(row.source, indexingStatus)}
            isConnecting={isConnecting}
            onConnect={() => void reconnectGoogle()}
          />
        ))}
      </div>
    </section>
  );
}

function StepItem({
  step,
  title,
  description,
  done,
}: {
  step: string;
  title: string;
  description: string;
  done: boolean;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
        done
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400'
      }`}>
        {step}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function MemorySourceRow({
  row,
  presentation,
  indexingInfo,
  isConnecting,
  onConnect,
}: {
  row: WorkspaceRow;
  presentation: SourcePresentation;
  indexingInfo: IndexingInfo;
  isConnecting: boolean;
  onConnect: () => void;
}) {
  const isBusy = row.isLoading || row.isSyncing;
  const actionDisabled = presentation.buttonKind === 'connect'
    ? isConnecting
    : !row.connected || isBusy;
  const action = presentation.buttonKind === 'connect' ? onConnect : row.onImport;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${sourceAccent[row.source]}`} aria-hidden />
            <h4 className="text-base font-semibold text-slate-950 dark:text-slate-100">
              {row.label}
            </h4>
            <span className={`status-badge ${toneBadgeClass(presentation.tone)}`}>
              {presentation.statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {row.description}
          </p>
          <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            Try: {row.examples[0]}
          </p>
          {row.feedback?.type === 'error' && (
            <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              {row.feedback.text}
            </p>
          )}
          {indexingInfo.detail && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              {indexingInfo.detail}
            </p>
          )}
        </div>

        <SourceMetric label="Imported" value={row.valueLabel} />
        <SourceMetric label="Last updated" value={formatLastSynced(row.lastSyncedAt)} />

        <div className="flex flex-col gap-2 lg:items-end">
          <button
            type="button"
            onClick={action}
            disabled={actionDisabled}
            className={`${presentation.buttonKind === 'connect' ? 'action-secondary' : 'action-primary'} min-w-40 disabled:cursor-not-allowed`}
          >
            {row.isSyncing ? 'Importing...' : isConnecting && presentation.buttonKind === 'connect' ? 'Opening...' : presentation.buttonLabel}
          </button>
          <p className="max-w-44 text-left text-xs leading-5 text-slate-500 dark:text-slate-400 lg:text-right">
            {presentation.statusDetail}
          </p>
        </div>
      </div>
    </div>
  );
}

function SourceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function getSourcePresentation(row: WorkspaceRow, indexingInfo: IndexingInfo): SourcePresentation {
  if (row.isLoading) {
    return {
      statusLabel: 'Checking access',
      statusDetail: 'Loading Google source status.',
      tone: 'working',
      buttonLabel: 'Checking...',
      buttonKind: 'import',
    };
  }

  if (row.feedback?.type === 'error') {
    return {
      statusLabel: isReconnectError(row.feedback.text) ? 'Fix access' : 'Needs attention',
      statusDetail: friendlyError(row.feedback.text),
      tone: 'attention',
      buttonLabel: isReconnectError(row.feedback.text) ? 'Reconnect Google' : 'Try again',
      buttonKind: isReconnectError(row.feedback.text) ? 'connect' : 'import',
    };
  }

  if (!row.connected) {
    return {
      statusLabel: 'Not connected',
      statusDetail: 'Connect Google before importing this source.',
      tone: 'idle',
      buttonLabel: 'Connect Google',
      buttonKind: 'connect',
    };
  }

  if (indexingInfo.failed) {
    return {
      statusLabel: 'Needs attention',
      statusDetail: 'Some imported items could not become AI memory yet.',
      tone: 'attention',
      buttonLabel: 'Retry import',
      buttonKind: 'import',
    };
  }

  if (indexingInfo.active) {
    return {
      statusLabel: indexingInfo.tone === 'attention' ? 'Retrying memory' : 'Preparing memory',
      statusDetail: 'Second Brain is still turning this source into searchable memory.',
      tone: indexingInfo.tone,
      buttonLabel: 'Refresh import',
      buttonKind: 'import',
    };
  }

  if (row.valueCount > 0) {
    return {
      statusLabel: 'Ready for AI',
      statusDetail: `Ask your Second Brain with ${row.noun} as citations.`,
      tone: 'ready',
      buttonLabel: 'Refresh import',
      buttonKind: 'import',
    };
  }

  if (row.lastSyncedAt) {
    return {
      statusLabel: 'No data found',
      statusDetail: 'Google returned no items for the current import window.',
      tone: 'idle',
      buttonLabel: `Import ${row.noun}`,
      buttonKind: 'import',
    };
  }

  return {
    statusLabel: 'Import needed',
    statusDetail: 'Import this source when you want it included in AI answers.',
    tone: 'idle',
    buttonLabel: `Import ${row.noun}`,
    buttonKind: 'import',
  };
}

function getIndexingInfo(source: WorkspaceSource, indexingStatus?: IndexingStatus | null): IndexingInfo {
  if (!indexingStatus?.available) {
    return {
      label: 'Unknown',
      tone: 'attention',
      active: false,
      failed: false,
      detail: indexingStatus?.reason,
    };
  }

  const sourceJobs = indexingStatus.recent.filter((job) => job.sourceType === source);
  const activeJob = sourceJobs.find((job) => ['pending', 'retry', 'processing'].includes(job.status));
  if (activeJob) return indexingInfoFromJob(activeJob);

  const failedJob = sourceJobs.find((job) => ['dead_letter', 'failed'].includes(job.status));
  if (failedJob) return indexingInfoFromJob(failedJob);

  return {
    label: 'Ready',
    tone: 'ready',
    active: false,
    failed: false,
  };
}

function indexingInfoFromJob(job: IndexingJobStatus): IndexingInfo {
  const failed = ['dead_letter', 'failed'].includes(job.status);
  const active = ['pending', 'retry', 'processing'].includes(job.status);
  return {
    label: job.status.replaceAll('_', ' '),
    tone: failed ? 'attention' : job.status === 'retry' ? 'attention' : 'working',
    active,
    failed,
    detail: job.error ? friendlyError(job.error) : undefined,
  };
}

function isReconnectError(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('reconnect') ||
    normalized.includes('scope') ||
    normalized.includes('permission') ||
    normalized.includes('not connected') ||
    normalized.includes('unauthorized')
  );
}

function friendlyError(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (/internal server error/i.test(normalized)) {
    return 'The API hit an unexpected error. Check the API terminal log, then try this source again.';
  }
  if (/quota|too many requests|429/i.test(normalized)) {
    return 'AI quota or rate limit is blocking memory extraction. Wait a bit or switch model/key before retrying.';
  }
  if (/scope|permission|reconnect/i.test(normalized)) {
    return 'Google permission is missing. Reconnect Google and approve this source.';
  }
  if (normalized.length <= 140) return normalized;
  return `${normalized.slice(0, 137)}...`;
}

function toneBadgeClass(tone: SourceTone) {
  if (tone === 'ready') return 'status-badge-success';
  if (tone === 'attention') return 'status-badge-danger';
  if (tone === 'working') return 'status-badge-warning';
  return '';
}

function formatLastSynced(value: string | null) {
  if (!value) return 'Not imported';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
