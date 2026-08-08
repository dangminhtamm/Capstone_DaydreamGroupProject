export type DriveConnectionStatus = {
  source?: 'drive';
  oauthMode?: 'all_google_sources';
  connected: boolean;
  scopes?: string[];
  requestedScopes?: string[];
  workspaceScopes?: string[];
  fileCount: number;
  lastSyncedAt: string | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
  syncCursor?: unknown | null;
};

export type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  iconLink: string | null;
  thumbnailLink: string | null;
  modifiedTime: string | null;
};

export type DriveSyncResult = {
  message: string;
  syncedCount: number;
  queuedIndexingJobs?: number;
  memoryIndexingStatus?: 'queued' | 'succeeded' | 'failed';
};

export type DriveFeedback = {
  type: 'success' | 'error';
  text: string;
};
