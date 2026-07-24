export type ContactConnectionStatus = {
  connected: boolean;
  contactCount: number;
  lastSyncedAt: string | null;
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
