export type ContactConnectionStatus = {
  source?: 'contact';
  oauthMode?: 'all_google_sources';
  connected: boolean;
  scopes?: string[];
  requestedScopes?: string[];
  workspaceScopes?: string[];
  contactCount: number;
  lastSyncedAt: string | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
  syncCursor?: unknown | null;
};

export type GoogleContact = {
  id: string;
  displayName: string;
  emailAddresses: string[];
  phoneNumbers: string[];
  organizations: string[];
  photoUrl: string | null;
};

export type ContactSyncResult = {
  message: string;
  syncedCount: number;
  queuedIndexingJobs?: number;
  memoryIndexingStatus?: 'queued' | 'succeeded' | 'failed';
};

export type ContactFeedback = {
  type: 'success' | 'error';
  text: string;
};
