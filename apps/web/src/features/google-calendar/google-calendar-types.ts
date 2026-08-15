export type CalendarConnectionStatus = {
  source?: 'calendar';
  oauthMode?: 'all_google_sources' | 'source_scoped';
  connected: boolean;
  scopes?: string[];
  requestedScopes?: string[];
  workspaceScopes?: string[];
  eventCount: number;
  lastSyncedAt: string | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
  syncCursor?: unknown | null;
};

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  htmlLink: string | null;
};

export type CalendarSyncResult = {
  message: string;
  syncedCount: number;
  queuedIndexingJobs?: number;
  linkedDiaryCount?: number;
  linkedEventCount?: number;
  memoryIndexingStatus?: 'queued' | 'succeeded' | 'failed';
};

export type CalendarFeedback = {
  type: 'success' | 'error';
  text: string;
};

export type CalendarErrorKind =
  | 'not_authenticated'
  | 'not_connected'
  | 'oauth_rejected'
  | 'backend_unavailable'
  | 'sync_failed'
  | 'unknown';

export type CalendarError = {
  kind: CalendarErrorKind;
  message: string;
};

type CalendarState = {
  status: CalendarConnectionStatus | null;
  events: CalendarEvent[];
  isLoading: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  error: CalendarError | null;
  feedback: CalendarFeedback | null;
};
