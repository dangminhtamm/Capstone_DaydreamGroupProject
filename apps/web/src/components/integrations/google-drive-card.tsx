'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCalendarConnectUrl } from '@/features/google-calendar/google-calendar-api';
import { isSafeRedirectUrl } from '@/features/google-calendar/google-calendar-utils';
import { useGoogleDriveIntegration } from '@/features/google-drive/use-google-drive';

export function GoogleDriveCard() {
  const auth = useAuth();
  const { isAuthenticated, getAccessToken } = auth;
  const [isConnecting, setIsConnecting] = useState(false);
  const {
    status,
    files,
    isLoading,
    isSyncing,
    feedback,
    loadDrive,
    syncGoogleDrive,
    clearFeedback,
  } = useGoogleDriveIntegration(auth);

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

  if (!isAuthenticated) {
    return (
      <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-lime-50/30 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-lime-950/20 dark:shadow-slate-900/40">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-600 dark:text-lime-400">
            Integrations
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">
            Google Drive
          </h3>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-600">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
            Sign in to sync Google Drive files.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-lime-50/30 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-lime-950/20 dark:shadow-slate-900/40">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-600 dark:text-lime-400">
          Integrations
        </p>
        <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">
          Google Drive
        </h3>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isLoading ? 'Checking Drive...' : status?.connected ? 'Google connected' : 'Reconnect Google to add Drive scope'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {status
                  ? `${status.fileCount} file${status.fileCount === 1 ? '' : 's'} saved${status.lastSyncedAt ? `, last synced ${new Date(status.lastSyncedAt).toLocaleDateString()}` : ''}`
                  : 'Drive uses the same Google OAuth connection as Calendar.'}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              status?.connected
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800'
                : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800'
            }`}>
              {status?.connected ? 'Ready' : 'Needs reconnect'}
            </span>
          </div>
        </div>

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
            onClick={() => void reconnectGoogle()}
            disabled={isConnecting}
            className="cursor-pointer rounded-xl border border-lime-200 bg-lime-50 px-4 py-2.5 text-sm font-semibold text-lime-700 transition hover:bg-lime-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-lime-800 dark:bg-lime-950/40 dark:text-lime-200 dark:hover:bg-lime-900/50"
          >
            {isConnecting ? 'Connecting...' : 'Reconnect Google'}
          </button>
          <button
            type="button"
            onClick={() => void syncGoogleDrive(20)}
            disabled={!status?.connected || isSyncing}
            className="cursor-pointer rounded-xl bg-lime-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : 'Sync Drive'}
          </button>
          <button
            type="button"
            onClick={() => void loadDrive()}
            disabled={isLoading}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {files.length > 0 && (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white/80 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800/60">
            {files.slice(0, 5).map((file) => (
              <div key={file.id} className="px-4 py-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {file.name}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {[file.mimeType, file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : null].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
