export type GmailConnectionStatus = {
  source?: 'gmail';
  oauthMode?: 'all_google_sources';
  connected: boolean;
  scopes?: string[];
  requestedScopes?: string[];
  workspaceScopes?: string[];
  messageCount: number;
  lastSyncedAt: string | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
  syncCursor?: unknown | null;
};

export type GmailMessage = {
  id: string;
  external_id: string;
  thread_id: string | null;
  sender: string;
  subject: string;
  snippet: string | null;
  received_at: string | null;
  updated_at: string;
};

export type GmailSyncResult = {
  message: string;
  syncedCount: number;
  queuedIndexingJobs?: number;
  memoryIndexingStatus?: 'queued' | 'succeeded' | 'failed';
};

export type GmailFeedback = {
  type: 'success' | 'error';
  text: string;
};
