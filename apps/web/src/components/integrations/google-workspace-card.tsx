'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCalendarConnectUrl } from '@/features/google-calendar/google-calendar-api';
import { isSafeRedirectUrl } from '@/features/google-calendar/google-calendar-utils';
import { useGoogleCalendarIntegration } from '@/features/google-calendar/use-google-calendar';
import { disconnectGoogle } from '@/features/google-connections/google-connections-api';
import { useGoogleContactsIntegration } from '@/features/google-contacts/use-google-contacts';
import { useGoogleDriveIntegration } from '@/features/google-drive/use-google-drive';
import { useGoogleGmailIntegration } from '@/features/google-gmail/use-google-gmail';
import type { IndexingJobStatus, IndexingStatus } from '@/lib/api-client';

type GoogleWorkspaceCardProps = {
  indexingStatus?: IndexingStatus | null;
  variant?: 'user' | 'admin';
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
  syncedTo: string;
  aiUsage: string;
  valueLabel: string;
  valueCount: number;
  noun: string;
  lastSyncedAt: string | null;
  scopes: string[];
  requestedScopes: string[];
  workspaceScopes: string[];
  lastError: string | null;
  lastErrorAt: string | null;
  connected: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  feedback?: SourceFeedback | null;
  examples: string[];
  onImport: () => void;
  selectiveImport?: SelectiveImportControl;
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

type SelectableImportCandidate = {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  date: string | null;
  alreadyImported: boolean;
  href?: string | null;
  iconUrl?: string | null;
  thumbnailUrl?: string | null;
  previewKind?: 'drive' | 'gmail';
};

type SelectiveImportControl = {
  query: string;
  queryPlaceholder: string;
  emptyLabel: string;
  browseLabel: string;
  importLabel: string;
  candidates: SelectableImportCandidate[];
  selectedIds: string[];
  isListing: boolean;
  onQueryChange: (value: string) => void;
  onBrowse: () => void;
  onToggle: (id: string) => void;
  onImportSelected: () => void;
};

const sourceAccent: Record<WorkspaceSource, string> = {
  calendar: 'bg-sky-500',
  contact: 'bg-fuchsia-500',
  drive: 'bg-lime-500',
  gmail: 'bg-rose-500',
};

const sourceSoftAccent: Record<WorkspaceSource, string> = {
  calendar: 'border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300',
  contact: 'border-fuchsia-100 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/30 dark:text-fuchsia-300',
  drive: 'border-lime-100 bg-lime-50 text-lime-700 dark:border-lime-900/50 dark:bg-lime-950/30 dark:text-lime-300',
  gmail: 'border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300',
};

export function GoogleWorkspaceCard({ indexingStatus, variant = 'user' }: GoogleWorkspaceCardProps) {
  const auth = useAuth();
  const { isAuthenticated, getAccessToken } = auth;
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [deleteSyncedGoogleData, setDeleteSyncedGoogleData] = useState(false);
  const [workspaceFeedback, setWorkspaceFeedback] = useState<SourceFeedback | null>(null);
  const calendar = useGoogleCalendarIntegration(auth);
  const contacts = useGoogleContactsIntegration(auth);
  const drive = useGoogleDriveIntegration(auth);
  const gmail = useGoogleGmailIntegration(auth);
  const [driveImportQuery, setDriveImportQuery] = useState('');
  const [gmailImportQuery, setGmailImportQuery] = useState('');
  const [selectedDriveIds, setSelectedDriveIds] = useState<string[]>([]);
  const [selectedGmailIds, setSelectedGmailIds] = useState<string[]>([]);
  const [activeImportSource, setActiveImportSource] = useState<'drive' | 'gmail' | null>(null);

  const browseDriveCandidates = useCallback(async () => {
    const candidates = await drive.listImportCandidates({ limit: 25, query: driveImportQuery });
    const candidateIds = new Set(candidates.map((candidate) => candidate.id));
    setSelectedDriveIds((current) => current.filter((id) => candidateIds.has(id)));
  }, [drive, driveImportQuery]);

  const browseGmailCandidates = useCallback(async () => {
    const candidates = await gmail.listImportCandidates({ limit: 25, query: gmailImportQuery });
    const candidateIds = new Set(candidates.map((candidate) => candidate.id));
    setSelectedGmailIds((current) => current.filter((id) => candidateIds.has(id)));
  }, [gmail, gmailImportQuery]);

  const importSelectedDrive = useCallback(async () => {
    const imported = await drive.importSelectedDriveFiles(selectedDriveIds);
    if (imported) setSelectedDriveIds([]);
  }, [drive, selectedDriveIds]);

  const importSelectedGmail = useCallback(async () => {
    const imported = await gmail.importSelectedGmailMessages(selectedGmailIds);
    if (imported) setSelectedGmailIds([]);
  }, [gmail, selectedGmailIds]);

  const toggleDriveCandidate = useCallback((id: string) => {
    setSelectedDriveIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }, []);

  const toggleGmailCandidate = useCallback((id: string) => {
    setSelectedGmailIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }, []);

  const openDriveImportModal = useCallback(() => {
    setActiveImportSource('drive');
    void browseDriveCandidates();
  }, [browseDriveCandidates]);

  const openGmailImportModal = useCallback(() => {
    setActiveImportSource('gmail');
    void browseGmailCandidates();
  }, [browseGmailCandidates]);

  const rows: WorkspaceRow[] = useMemo(() => [
    {
      source: 'calendar',
      label: 'Calendar',
      description: 'Meetings and events that explain what happened around diary entries.',
      syncedTo: 'calendar_events, diary links, memory_chunks',
      aiUsage: 'Answers can cite meetings, deadlines, and the events linked to diary days.',
      valueLabel: `${calendar.status?.eventCount ?? 0} events`,
      valueCount: calendar.status?.eventCount ?? 0,
      noun: 'events',
      lastSyncedAt: calendar.status?.lastSyncedAt ?? null,
      scopes: calendar.status?.scopes ?? [],
      requestedScopes: calendar.status?.requestedScopes ?? ['https://www.googleapis.com/auth/calendar.readonly'],
      workspaceScopes: calendar.status?.workspaceScopes ?? [],
      lastError: calendar.status?.lastError ?? null,
      lastErrorAt: calendar.status?.lastErrorAt ?? null,
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
      syncedTo: 'gmail_messages, indexing_outbox, memory_chunks',
      aiUsage: 'Answers can cite email feedback, decisions, and project conversations.',
      valueLabel: `${gmail.status?.messageCount ?? 0} messages`,
      valueCount: gmail.status?.messageCount ?? 0,
      noun: 'messages',
      lastSyncedAt: gmail.status?.lastSyncedAt ?? null,
      scopes: gmail.status?.scopes ?? [],
      requestedScopes: gmail.status?.requestedScopes ?? ['https://www.googleapis.com/auth/gmail.readonly'],
      workspaceScopes: gmail.status?.workspaceScopes ?? [],
      lastError: gmail.status?.lastError ?? null,
      lastErrorAt: gmail.status?.lastErrorAt ?? null,
      connected: Boolean(gmail.status?.connected),
      isLoading: gmail.isLoading,
      isSyncing: gmail.isSyncing,
      feedback: gmail.feedback,
      examples: [
        'What feedback did Linh send?',
        'Which emails mention the demo?',
      ],
      onImport: openGmailImportModal,
      selectiveImport: {
        query: gmailImportQuery,
        queryPlaceholder: 'Search sender, subject, or Gmail query',
        emptyLabel: 'Browse Gmail to choose specific messages before importing.',
        browseLabel: 'Choose emails',
        importLabel: 'Import selected emails',
        candidates: gmail.candidates.map((message) => ({
          id: message.id,
          title: message.subject,
          subtitle: message.sender,
          detail: message.snippet ?? 'No preview text available.',
          date: message.receivedAt,
          alreadyImported: message.alreadyImported,
          previewKind: 'gmail',
        })),
        selectedIds: selectedGmailIds,
        isListing: gmail.isListingCandidates,
        onQueryChange: setGmailImportQuery,
        onBrowse: () => void browseGmailCandidates(),
        onToggle: toggleGmailCandidate,
        onImportSelected: () => void importSelectedGmail(),
      },
    },
    {
      source: 'drive',
      label: 'Drive',
      description: 'Docs and files that Second Brain can quote when answering questions.',
      syncedTo: 'google_drive_files, indexing_outbox, memory_chunks',
      aiUsage: 'Answers can cite imported docs, plans, and file summaries.',
      valueLabel: `${drive.status?.fileCount ?? 0} files`,
      valueCount: drive.status?.fileCount ?? 0,
      noun: 'files',
      lastSyncedAt: drive.status?.lastSyncedAt ?? null,
      scopes: drive.status?.scopes ?? [],
      requestedScopes: drive.status?.requestedScopes ?? ['https://www.googleapis.com/auth/drive.readonly'],
      workspaceScopes: drive.status?.workspaceScopes ?? [],
      lastError: drive.status?.lastError ?? null,
      lastErrorAt: drive.status?.lastErrorAt ?? null,
      connected: Boolean(drive.status?.connected),
      isLoading: drive.isLoading,
      isSyncing: drive.isSyncing,
      feedback: drive.feedback,
      examples: [
        'What does the demo plan require?',
        'Which document explains MVP scope?',
      ],
      onImport: openDriveImportModal,
      selectiveImport: {
        query: driveImportQuery,
        queryPlaceholder: 'Search file name',
        emptyLabel: 'Browse Drive to choose specific files before importing.',
        browseLabel: 'Choose files',
        importLabel: 'Import selected files',
        candidates: drive.candidates.map((file) => ({
          id: file.id,
          title: file.name,
          subtitle: formatDriveMimeType(file.mimeType),
          detail: file.size ? formatFileSize(file.size) : 'No file size available.',
          date: file.modifiedTime,
          alreadyImported: file.alreadyImported,
          href: file.webViewLink,
          iconUrl: file.iconLink,
          thumbnailUrl: file.thumbnailLink,
          previewKind: 'drive',
        })),
        selectedIds: selectedDriveIds,
        isListing: drive.isListingCandidates,
        onQueryChange: setDriveImportQuery,
        onBrowse: () => void browseDriveCandidates(),
        onToggle: toggleDriveCandidate,
        onImportSelected: () => void importSelectedDrive(),
      },
    },
    {
      source: 'contact',
      label: 'Contacts',
      description: 'People and organizations that help AI understand names in your memories.',
      syncedTo: 'google_contacts, entity context, memory_chunks',
      aiUsage: 'Answers can resolve who people are and cite relevant contact context.',
      valueLabel: `${contacts.status?.contactCount ?? 0} contacts`,
      valueCount: contacts.status?.contactCount ?? 0,
      noun: 'contacts',
      lastSyncedAt: contacts.status?.lastSyncedAt ?? null,
      scopes: contacts.status?.scopes ?? [],
      requestedScopes: contacts.status?.requestedScopes ?? ['https://www.googleapis.com/auth/contacts.readonly'],
      workspaceScopes: contacts.status?.workspaceScopes ?? [],
      lastError: contacts.status?.lastError ?? null,
      lastErrorAt: contacts.status?.lastErrorAt ?? null,
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
  ], [
    browseDriveCandidates,
    browseGmailCandidates,
    calendar,
    contacts,
    drive,
    driveImportQuery,
    gmail,
    gmailImportQuery,
    importSelectedDrive,
    importSelectedGmail,
    openDriveImportModal,
    openGmailImportModal,
    selectedDriveIds,
    selectedGmailIds,
    toggleDriveCandidate,
    toggleGmailCandidate,
  ]);

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
  const activeIndexingCount = rows.filter((row) => getIndexingInfo(row.source, indexingStatus).active).length;
  const importedCount = rows.reduce((total, row) => total + (row.valueCount > 0 ? 1 : 0), 0);
  const workspaceScopes = rows.find((row) => row.workspaceScopes.length > 0)?.workspaceScopes ?? [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/contacts.readonly',
  ];
  const overallTone: SourceTone = attentionCount > 0 ? 'attention' : readyCount > 0 ? 'ready' : connected ? 'working' : 'idle';
  const overallLabel = !connected
    ? 'Connect a source'
    : attentionCount > 0
      ? `${attentionCount} source${attentionCount === 1 ? '' : 's'} need attention`
      : readyCount > 0
        ? `${readyCount}/4 indexed`
        : 'Import sources';

  const reconnectGoogle = async (source: WorkspaceSource | 'all' = 'all') => {
    setIsConnecting(true);
    clearFeedback();
    try {
      const url = await fetchCalendarConnectUrl(getAccessToken(), source);
      if (!isSafeRedirectUrl(url)) {
        throw new Error('Received an invalid redirect URL from the server.');
      }
      window.location.href = url;
    } catch {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (deleteSyncedGoogleData) {
      const confirmed = window.confirm(
        'Disconnect Google and delete synced Calendar, Gmail, Drive, Contacts, and Google memory chunks from this workspace?',
      );
      if (!confirmed) return;
    }

    setIsDisconnecting(true);
    clearFeedback();
    try {
      const result = await disconnectGoogle(getAccessToken(), {
        deleteSyncedData: deleteSyncedGoogleData,
      });
      const deletedTotal = Object.values(result.deletedCounts).reduce((total, count) => total + count, 0);
      setWorkspaceFeedback({
        type: 'success',
        text: result.deleteSyncedData
          ? `Google disconnected and ${deletedTotal} synced records/chunks were deleted.`
          : 'Google disconnected. Synced data was kept in this workspace.',
      });
      setDeleteSyncedGoogleData(false);
      await Promise.all([
        calendar.loadCalendar(),
        contacts.loadContacts(),
        drive.loadDrive(),
        gmail.loadGmail(),
      ]);
    } catch (error) {
      setWorkspaceFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not disconnect Google.',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const clearFeedback = () => {
    setWorkspaceFeedback(null);
    calendar.clearFeedback();
    contacts.clearFeedback();
    drive.clearFeedback();
    gmail.clearFeedback();
  };

  const feedback = workspaceFeedback ?? calendar.feedback ?? contacts.feedback ?? drive.feedback ?? gmail.feedback;
  const activeImportRow = activeImportSource ? rows.find((row) => row.source === activeImportSource) : null;

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

  if (variant === 'user') {
    return (
      <section id="google-workspace" className="scroll-mt-24 enterprise-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Google Workspace
            </p>
            <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
              Bring useful Google context into Search
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Connect only the Google source you need, choose what to import, then ask Second Brain questions with citations from those sources.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`status-badge ${toneBadgeClass(overallTone)}`}>
              {overallLabel}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <UserGoogleSourceCard
              key={row.source}
              row={row}
              presentation={presentations[row.source]}
              indexingInfo={getIndexingInfo(row.source, indexingStatus)}
              isConnecting={isConnecting}
              onConnect={() => void reconnectGoogle(row.source)}
            />
          ))}
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

        {connected && (
          <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
              Privacy controls
            </summary>
            <div className="mt-3 space-y-3">
              <label className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={deleteSyncedGoogleData}
                  onChange={(event) => setDeleteSyncedGoogleData(event.target.checked)}
                  disabled={isDisconnecting}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 disabled:cursor-not-allowed"
                />
                <span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    Delete imported Google data too
                  </span>
                  <span className="block text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Removes imported Google rows, memory chunks, and pending Google indexing jobs from this workspace.
                  </span>
                </span>
              </label>
              <button
                type="button"
                onClick={() => void handleDisconnectGoogle()}
                disabled={isDisconnecting}
                className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/60 dark:bg-slate-950 dark:text-rose-300 dark:hover:bg-rose-950/30"
              >
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect Google'}
              </button>
            </div>
          </details>
        )}

        {activeImportRow?.selectiveImport && (
          <GoogleImportSelectionModal
            isOpen
            sourceLabel={activeImportRow.label}
            control={activeImportRow.selectiveImport}
            isImporting={activeImportRow.isSyncing}
            onClose={() => setActiveImportSource(null)}
          />
        )}
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
            Google sources for AI Recall
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Connect individual sources for least-privilege access, or connect all sources explicitly for a full demo import.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Google access
            </span>
            <ScopeChips scopes={workspaceScopes} compact />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`status-badge ${toneBadgeClass(overallTone)}`}>
            {overallLabel}
          </span>
          <button
            type="button"
            onClick={() => void reconnectGoogle('all')}
            disabled={isConnecting}
            className="action-secondary disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Opening Google...' : connected ? 'Reconnect all Google sources' : 'Connect all Google sources'}
          </button>
          {connected && (
            <button
              type="button"
              onClick={() => void handleDisconnectGoogle()}
              disabled={isDisconnecting}
              className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/60 dark:bg-slate-950 dark:text-rose-300 dark:hover:bg-rose-950/30"
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect Google'}
            </button>
          )}
        </div>
      </div>

      {connected && (
        <label className="mt-4 flex max-w-3xl items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
          <input
            type="checkbox"
            checked={deleteSyncedGoogleData}
            onChange={(event) => setDeleteSyncedGoogleData(event.target.checked)}
            disabled={isDisconnecting}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 disabled:cursor-not-allowed"
          />
          <span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Delete synced Google data
            </span>
            <span className="block text-xs leading-5 text-slate-500 dark:text-slate-400">
              Removes imported Calendar events, Gmail messages, Drive files, Contacts, Google memory chunks, and pending Google indexing jobs.
            </span>
          </span>
        </label>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StepItem
          step="1"
          title="Connect"
          description={connected ? 'At least one readonly Google source is connected.' : 'Connect only the source you plan to import, or explicitly connect all.'}
          done={connected}
        />
        <StepItem
          step="2"
          title="Import"
          description={importedCount > 0 ? `${importedCount}/4 sources have imported rows.` : 'Pick a source and copy metadata/text into the app.'}
          done={importedCount > 0}
        />
        <StepItem
          step="3"
          title="Indexed"
          description={activeIndexingCount > 0 ? `${activeIndexingCount} source${activeIndexingCount === 1 ? '' : 's'} still indexing.` : readyCount > 0 ? 'Imported data has memory chunks.' : 'Indexing starts after import.'}
          done={readyCount > 0 && activeIndexingCount === 0}
        />
        <StepItem
          step="4"
          title="Ask"
          description={readyCount > 0 ? 'Search can cite ready Google sources.' : 'Ready sources appear as cited evidence.'}
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
            onConnect={() => void reconnectGoogle(row.source)}
          />
        ))}
      </div>
      {activeImportRow?.selectiveImport && (
        <GoogleImportSelectionModal
          isOpen
          sourceLabel={activeImportRow.label}
          control={activeImportRow.selectiveImport}
          isImporting={activeImportRow.isSyncing}
          onClose={() => setActiveImportSource(null)}
        />
      )}
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

function UserGoogleSourceCard({
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
  const selection = row.selectiveImport;
  const isBusy = row.isLoading || row.isSyncing || Boolean(selection?.isListing);
  const actionDisabled = presentation.buttonKind === 'connect'
    ? isConnecting
    : !row.connected || isBusy;
  const action = presentation.buttonKind === 'connect' ? onConnect : row.onImport;
  const imported = row.valueCount > 0 || Boolean(row.lastSyncedAt);
  const memoryReady = presentation.tone === 'ready';
  const buttonLabel = selection
    ? selection.isListing
      ? 'Loading list...'
      : selection.browseLabel
    : presentation.buttonLabel;
  const firstExample = row.examples[0];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-blue-900/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${sourceAccent[row.source]}`} aria-hidden />
            <h4 className="text-base font-semibold text-slate-950 dark:text-slate-100">{row.label}</h4>
            <span className={`status-badge ${toneBadgeClass(presentation.tone)}`}>
              {presentation.statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {row.description}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sourceSoftAccent[row.source]}`}>
          {row.valueLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <FlowState label="Connected" done={row.connected} active={!row.connected && presentation.buttonKind === 'connect'} />
        <FlowState label="Imported" done={imported} active={row.isSyncing} />
        <FlowState label="Ready for AI" done={memoryReady} active={indexingInfo.active} attention={indexingInfo.failed || presentation.tone === 'attention'} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
            {presentation.statusDetail}
          </p>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            Last import: {formatLastSynced(row.lastSyncedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={action}
          disabled={actionDisabled}
          className={`${presentation.buttonKind === 'connect' ? 'action-secondary' : 'action-primary'} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {row.isSyncing ? 'Importing...' : isConnecting && presentation.buttonKind === 'connect' ? 'Opening...' : buttonLabel}
        </button>
      </div>

      {firstExample ? (
        <Link
          href={`/search?q=${encodeURIComponent(firstExample)}`}
          className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
        >
          Try: {firstExample}
        </Link>
      ) : null}

      {row.feedback?.type === 'error' ? (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {row.feedback.text}
        </p>
      ) : null}
      {row.lastError && !row.feedback ? (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {friendlyError(row.lastError)}
        </p>
      ) : null}
      {indexingInfo.detail && !indexingInfo.failed ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {indexingInfo.detail}
        </p>
      ) : null}
    </article>
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
  const selection = row.selectiveImport;
  const isBusy = row.isLoading || row.isSyncing || Boolean(selection?.isListing);
  const actionDisabled = presentation.buttonKind === 'connect'
    ? isConnecting
    : !row.connected || isBusy;
  const action = presentation.buttonKind === 'connect' ? onConnect : row.onImport;
  const buttonLabel = selection
    ? selection.isListing
      ? 'Loading list...'
      : selection.browseLabel
    : presentation.buttonLabel;
  const imported = row.valueCount > 0 || Boolean(row.lastSyncedAt);
  const memoryReady = presentation.tone === 'ready';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-blue-900/70">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)_auto] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${sourceAccent[row.source]}`} aria-hidden />
            <h4 className="text-base font-semibold text-slate-950 dark:text-slate-100">
              {row.label}
            </h4>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sourceSoftAccent[row.source]}`}>
              {row.valueLabel}
            </span>
            <span className={`status-badge ${toneBadgeClass(presentation.tone)}`}>
              {presentation.statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {row.description}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <SourceFact label="Imported into" value={row.syncedTo} />
            <SourceFact label="AI uses it for" value={row.aiUsage} />
          </div>
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Google scope
              </p>
              <ScopeChips scopes={row.scopes.length ? row.scopes : row.requestedScopes} compact />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {row.examples.map((example) => (
              <Link
                key={example}
                href={`/search?q=${encodeURIComponent(example)}`}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
              >
                Ask: {example}
              </Link>
            ))}
          </div>
          {row.feedback?.type === 'error' && (
            <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              {row.feedback.text}
            </p>
          )}
          {row.lastError && !row.feedback && (
            <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              Last sync error{row.lastErrorAt ? ` (${formatLastSynced(row.lastErrorAt)})` : ''}: {friendlyError(row.lastError)}
            </p>
          )}
          {indexingInfo.detail && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              {indexingInfo.detail}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {"Connect -> Import -> Indexed -> Ask"}
            </p>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {formatLastSynced(row.lastSyncedAt)}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-4 xl:grid-cols-1">
            <FlowState label="Connect" done={row.connected} active={!row.connected && presentation.buttonKind === 'connect'} />
            <FlowState label="Import" done={imported} active={row.isSyncing} />
            <FlowState label="Indexed" done={memoryReady} active={indexingInfo.active} attention={indexingInfo.failed || presentation.tone === 'attention'} />
            <FlowState label="Ask" done={memoryReady} active={false} attention={indexingInfo.failed || presentation.tone === 'attention'} />
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
          <button
            type="button"
            onClick={action}
            disabled={actionDisabled}
            className={`${presentation.buttonKind === 'connect' ? 'action-secondary' : 'action-primary'} min-w-40 disabled:cursor-not-allowed`}
          >
            {row.isSyncing ? 'Importing...' : isConnecting && presentation.buttonKind === 'connect' ? 'Opening...' : buttonLabel}
          </button>
          <p className="max-w-44 text-left text-xs leading-5 text-slate-500 dark:text-slate-400 lg:text-right">
            {presentation.statusDetail}
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleImportSelectionModal({
  isOpen,
  sourceLabel,
  control,
  isImporting,
  onClose,
}: {
  isOpen: boolean;
  sourceLabel: string;
  control: SelectiveImportControl;
  isImporting: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const selectedSet = new Set(control.selectedIds);
  const selectedCount = control.selectedIds.length;
  const disabled = isImporting || control.isListing;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !disabled) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close import picker"
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
        onClick={() => {
          if (!disabled) onClose();
        }}
      />
      <div className="relative flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Selective import
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
                Choose {sourceLabel} memory sources
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Browse Google first, select only the items you want, then import them into Second Brain for indexing and citations.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={disabled}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Close
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center">
            <input
              type="search"
              value={control.query}
              onChange={(event) => control.onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  control.onBrowse();
                }
              }}
              placeholder={control.queryPlaceholder}
              className="min-h-11 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-800 dark:focus:ring-blue-950/50"
              disabled={disabled}
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={control.onBrowse}
                disabled={disabled}
                className="action-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {control.isListing ? 'Loading...' : 'Refresh list'}
              </button>
              <button
                type="button"
                onClick={control.onImportSelected}
                disabled={disabled || selectedCount === 0}
                className="action-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isImporting
                  ? 'Importing...'
                  : selectedCount > 0
                    ? `${control.importLabel} (${selectedCount})`
                    : control.importLabel}
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/80 p-4 dark:bg-slate-900/40">
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            {control.isListing ? (
              <div className="grid gap-2 p-3">
                {[0, 1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-20 animate-pulse rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                ))}
              </div>
            ) : control.candidates.length > 0 ? (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {control.candidates.map((candidate) => (
                  <label
                    key={candidate.id}
                    className="flex cursor-pointer items-start gap-3 p-4 transition hover:bg-slate-50 dark:hover:bg-slate-900/70"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(candidate.id)}
                      onChange={() => control.onToggle(candidate.id)}
                      disabled={disabled}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                    />
                    <CandidatePreview candidate={candidate} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        {candidate.href ? (
                          <a
                            href={candidate.href}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-sm font-semibold text-slate-900 underline-offset-4 hover:underline dark:text-slate-100"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {candidate.title}
                          </a>
                        ) : (
                          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {candidate.title}
                          </span>
                        )}
                        {candidate.alreadyImported && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                            Imported
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                        {candidate.subtitle}
                        {candidate.date ? ` · ${formatLastSynced(candidate.date)}` : ''}
                      </span>
                      <span className="mt-1 line-clamp-3 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {candidate.detail}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="p-5 text-sm text-slate-500 dark:text-slate-400">
                {control.emptyLabel}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {selectedCount > 0
              ? `${selectedCount} item${selectedCount === 1 ? '' : 's'} selected for import.`
              : 'Nothing is imported until you select items and confirm.'}
          </p>
          <button
            type="button"
            onClick={control.onImportSelected}
            disabled={disabled || selectedCount === 0}
            className="action-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isImporting
              ? 'Importing...'
              : selectedCount > 0
                ? `${control.importLabel} (${selectedCount})`
                : control.importLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CandidatePreview({ candidate }: { candidate: SelectableImportCandidate }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = candidate.thumbnailUrl ?? candidate.iconUrl;
  const label = candidate.previewKind === 'gmail'
    ? getInitials(candidate.subtitle || candidate.title)
    : formatPreviewLabel(candidate.subtitle);

  return (
    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
      {imageUrl && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{label}</span>
      )}
    </span>
  );
}

function ScopeChips({ scopes, compact = false }: { scopes: string[]; compact?: boolean }) {
  if (!scopes.length) {
    return (
      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
        No scope recorded
      </span>
    );
  }

  return (
    <span className="flex flex-wrap gap-1.5">
      {scopes.map((scope) => (
        <span
          key={scope}
          title={scope}
          className={`rounded-full border border-slate-200 bg-white font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 ${
            compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
          }`}
        >
          {formatScope(scope)}
        </span>
      ))}
    </span>
  );
}

function SourceFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
        {value}
      </p>
    </div>
  );
}

function formatScope(scope: string) {
  if (scope.includes('/auth/calendar')) return 'Calendar readonly';
  if (scope.includes('/auth/gmail')) return 'Gmail readonly';
  if (scope.includes('/auth/drive')) return 'Drive readonly';
  if (scope.includes('/auth/contacts')) return 'Contacts readonly';
  return scope.replace(/^https:\/\/www\.googleapis\.com\/auth\//, '');
}

function formatDriveMimeType(mimeType: string) {
  if (mimeType === 'application/vnd.google-apps.document') return 'Google Doc';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'Google Sheet';
  if (mimeType === 'application/vnd.google-apps.presentation') return 'Google Slides';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.startsWith('text/')) return 'Text file';
  return mimeType.split('/').pop()?.replaceAll('.', ' ') ?? mimeType;
}

function formatPreviewLabel(value: string) {
  if (value === 'Google Doc') return 'DOC';
  if (value === 'Google Sheet') return 'XLS';
  if (value === 'Google Slides') return 'PPT';
  if (value === 'PDF') return 'PDF';
  if (value === 'Image') return 'IMG';
  if (value === 'Text file') return 'TXT';
  return 'FILE';
}

function formatFileSize(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Size unavailable';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function getInitials(value: string) {
  const words = value
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
  return initials || 'GM';
}

function FlowState({
  label,
  done,
  active,
  attention = false,
}: {
  label: string;
  done: boolean;
  active: boolean;
  attention?: boolean;
}) {
  const tone = attention ? 'attention' : done ? 'ready' : active ? 'working' : 'idle';
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
      <span className={`h-2.5 w-2.5 rounded-full ${
        tone === 'ready'
          ? 'bg-emerald-500'
          : tone === 'attention'
            ? 'bg-rose-500'
            : tone === 'working'
              ? 'bg-amber-500'
              : 'bg-slate-300 dark:bg-slate-600'
      }`} aria-hidden />
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </p>
    </div>
  );
}

function getSourcePresentation(row: WorkspaceRow, indexingInfo: IndexingInfo): SourcePresentation {
  if (row.isLoading) {
    return {
      statusLabel: 'Checking',
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
      buttonLabel: isReconnectError(row.feedback.text) ? `Reconnect ${row.label}` : 'Try again',
      buttonKind: isReconnectError(row.feedback.text) ? 'connect' : 'import',
    };
  }

  if (row.lastError && isReconnectError(row.lastError)) {
    return {
      statusLabel: 'Needs reconnect',
      statusDetail: friendlyError(row.lastError),
      tone: 'attention',
      buttonLabel: `Reconnect ${row.label}`,
      buttonKind: 'connect',
    };
  }

  if (!row.connected) {
    return {
      statusLabel: 'Connect first',
      statusDetail: `Connect ${row.label} readonly access, then import this source.`,
      tone: 'idle',
      buttonLabel: `Connect ${row.label}`,
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
      statusLabel: indexingInfo.tone === 'attention' ? 'Retrying index' : 'Indexing',
      statusDetail: 'Imported data is still becoming searchable memory.',
      tone: indexingInfo.tone,
      buttonLabel: 'Refresh import',
      buttonKind: 'import',
    };
  }

  if (row.valueCount > 0) {
    return {
      statusLabel: 'Indexed',
      statusDetail: `Ready to ask with ${row.noun} as citations.`,
      tone: 'ready',
      buttonLabel: 'Refresh import',
      buttonKind: 'import',
    };
  }

  if (row.lastSyncedAt) {
    return {
      statusLabel: 'Imported, no rows',
      statusDetail: 'Google returned no items for the current import window.',
      tone: 'idle',
      buttonLabel: `Import ${row.noun}`,
      buttonKind: 'import',
    };
  }

  return {
    statusLabel: 'Import next',
    statusDetail: 'Import this source to include it in AI answers.',
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
