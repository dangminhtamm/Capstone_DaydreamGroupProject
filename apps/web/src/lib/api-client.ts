const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type DiaryMood = 'great' | 'good' | 'neutral' | 'bad';

// Types - match backend DTO
export type DiaryEntry = {
  id: string;
  title: string;
  content: string;
  mood?: DiaryMood | null;
  tags?: string[];
  attachments?: Array<string | DiaryAttachment>;
  calendarEvents?: DiaryCalendarEvent[];
  entryDate?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
};

export type DiaryAttachment = {
  id: string;
  fileType: string;
  fileName: string;
  signedUrl?: string;
  extractionStatus: 'extracted' | 'pending' | 'empty';
  indexingStatus: 'pending' | 'retry' | 'processing' | 'succeeded' | 'dead_letter' | 'failed' | 'unknown';
  indexingError?: string | null;
  retryCount?: number;
  createdAt: string;
  updatedAt?: string;
};

export type DiaryCalendarEvent = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  htmlLink?: string | null;
};

export type CreateDiaryPayload = {
  title: string;
  content: string;
  mood?: DiaryMood | null;
  tags?: string[];
  attachments?: string[];
  entryDate?: string;
};

export type ApiError = {
  message: string;
  statusCode: number;
};

// Helper function for authenticated requests
async function authFetch(
  endpoint: string,
  options: RequestInit,
  accessToken: string | null
): Promise<Response> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  return response;
}

async function readApiError(response: Response, fallback: string) {
  const error = await response.json().catch(() => ({ message: fallback }));
  const message = error?.message;

  if (Array.isArray(message)) {
    return message.join(', ');
  }

  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return fallback || `HTTP ${response.status}`;
}

// Diary API functions
export const YEARLY_DIARY_ENTRY_LIMIT = 500;

export async function createDiaryEntry(
  payload: CreateDiaryPayload,
  accessToken: string | null
): Promise<DiaryEntry> {
  const response = await authFetch('/api/diary', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to create diary entry' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getDiaryEntries(
  accessToken: string | null,
  limit = YEARLY_DIARY_ENTRY_LIMIT,
): Promise<DiaryEntry[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  const response = await authFetch(`/api/diary?${query}`, {
    method: 'GET',
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch diary entries' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getDiaryEntry(
  id: string,
  accessToken: string | null
): Promise<DiaryEntry> {
  const response = await authFetch(`/api/diary/${id}`, {
    method: 'GET',
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch diary entry' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getDiaryAttachment(
  id: string,
  accessToken: string | null,
): Promise<{ signedUrl?: string }> {
  const response = await authFetch(`/api/upload/attachment/${id}`, {
    method: 'GET',
  }, accessToken);

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to refresh attachment URL'));
  }

  return response.json();
}

export async function getDiaryAttachmentContent(
  id: string,
  accessToken: string | null,
): Promise<Blob> {
  const response = await authFetch(`/api/upload/attachment/${id}/content`, {
    method: 'GET',
    headers: {
      Accept: 'audio/*',
    },
  }, accessToken);

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to load attachment audio'));
  }

  const content = await response.blob();
  if (!content.size) {
    throw new Error('Attachment audio is empty.');
  }

  return content;
}

export type UpdateDiaryPayload = {
  title?: string;
  content?: string;
  mood?: DiaryMood | null;
  tags?: string[];
  attachments?: string[];
  entryDate?: string;
};

export async function updateDiaryEntry(
  id: string,
  payload: UpdateDiaryPayload,
  accessToken: string | null
): Promise<DiaryEntry> {
  const response = await authFetch(`/api/diary/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update diary entry' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function deleteDiaryEntry(
  id: string,
  accessToken: string | null
): Promise<void> {
  const response = await authFetch(`/api/diary/${id}`, {
    method: 'DELETE',
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to delete diary entry' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
}

export async function copilotDiaryText(
  payload: { text: string; action: string },
  accessToken: string | null
): Promise<{ result: string }> {
  const response = await authFetch('/api/diary/copilot', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Copilot request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export type AttachmentUploadResponse = {
  message: string;
  extractionStatus: 'extracted' | 'pending' | 'empty';
  memoryIndexed: boolean;
  memoryIndexingStatus?: 'queued' | 'pending' | 'processing' | 'succeeded' | 'failed' | 'dead_letter' | 'retry';
  memoryChunkCount: number;
  processingError?: string;
  attachment: {
    id: string;
    diaryEntryId: string;
    fileType: string;
    extractionStatus?: 'extracted' | 'pending' | 'empty';
    signedUrl?: string;
    createdAt: string;
  };
};

export async function uploadDiaryAttachment(
  diaryEntryId: string,
  file: File,
  accessToken: string | null,
): Promise<AttachmentUploadResponse> {
  const formData = new FormData();
  formData.set('diaryEntryId', diaryEntryId);
  formData.set('file', file);

  const response = await authFetch('/api/upload/attachment', {
    method: 'POST',
    body: formData,
  }, accessToken);

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to upload attachment'));
  }

  return response.json();
}

export async function processDiaryAttachment(
  attachmentId: string,
  accessToken: string | null,
): Promise<AttachmentUploadResponse> {
  const response = await authFetch(`/api/upload/attachment/${attachmentId}/process`, {
    method: 'POST',
  }, accessToken);

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to process attachment'));
  }

  return response.json();
}

type AskPayload = {
  question: string;
};

type AskResponse = {
  answer: string;
  confidence?: "high" | "medium" | "low";
  sources: unknown[];
};

export async function askSearch(
  payload: AskPayload,
  accessToken: string | null
): Promise<AskResponse> {
  const response = await authFetch('/api/search', {
    method: "POST",
    body: JSON.stringify(payload),
  }, accessToken);

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch answer'));
  }

  return response.json() as Promise<AskResponse>;
}

// Summary API functions
export type SummaryType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type SummaryRecord = {
  id: string;
  type: SummaryType;
  content: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
};

export type GenerateSummaryPayload = {
  type: SummaryType;
  date?: string;
  force?: boolean;
};

export type GenerateSummaryResponse = {
  generated: boolean;
  summary: SummaryRecord;
  memoryIndexingStatus?: 'queued' | 'succeeded' | 'failed';
};

export async function getSummaries(
  accessToken: string | null,
  options: { type?: SummaryType; limit?: number } = {},
): Promise<SummaryRecord[]> {
  const params = new URLSearchParams();
  if (options.type) params.set('type', options.type);
  if (options.limit) params.set('limit', String(options.limit));

  const endpoint = `/api/summary${params.toString() ? `?${params}` : ''}`;
  const response = await authFetch(endpoint, {
    method: 'GET',
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch summaries' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json() as { summaries?: SummaryRecord[] };
  return data.summaries ?? [];
}

export async function generateSummary(
  payload: GenerateSummaryPayload,
  accessToken: string | null,
): Promise<GenerateSummaryResponse> {
  const response = await authFetch('/api/summary', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to generate summary' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Calendar API functions
export type CalendarConnectionStatus = {
  connected: boolean;
  eventCount: number;
  lastSyncedAt: string | null;
};

export type CalendarEventRecord = {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  htmlLink: string | null;
};

export type CalendarSyncResponse = {
  message: string;
  syncedCount: number;
  queuedIndexingJobs?: number;
  linkedDiaryCount?: number;
  linkedEventCount?: number;
  memoryIndexingStatus?: 'queued' | 'succeeded' | 'failed';
};

export async function getCalendarStatus(
  accessToken: string | null,
): Promise<CalendarConnectionStatus> {
  const response = await authFetch('/api/calendar/status', {
    method: 'GET',
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch calendar status' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getCalendarEvents(
  accessToken: string | null,
): Promise<CalendarEventRecord[]> {
  const response = await authFetch('/api/calendar/events', {
    method: 'GET',
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch calendar events' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json() as {
    events?: Array<{
      id: string;
      title: string;
      description?: string | null;
      start_time: string;
      end_time: string;
      html_link?: string | null;
    }>;
  };

  return (data.events ?? []).map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description ?? null,
    startTime: event.start_time,
    endTime: event.end_time,
    htmlLink: event.html_link ?? null,
  }));
}

export async function getGoogleCalendarConnectUrl(
  accessToken: string | null,
): Promise<string> {
  const response = await authFetch('/api/calendar/connect', {
    method: 'GET',
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to start Google Calendar connection' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json() as { url?: string };
  if (!data.url) {
    throw new Error('Backend did not return a Google Calendar connect URL');
  }

  return data.url;
}

export async function syncGoogleCalendar(
  accessToken: string | null,
  limit?: number,
): Promise<CalendarSyncResponse> {
  const query = limit ? `?${new URLSearchParams({ limit: String(limit) })}` : '';
  const response = await authFetch(`/api/calendar/sync${query}`, {
    method: 'POST',
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to sync Google Calendar' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// System health and indexing status
export type AdminDiagnostics = {
  status: 'ok' | 'degraded';
  checkedAt: string;
  database: {
    ok: boolean;
    detail?: string;
  };
  environment: {
    databaseConfigured: boolean;
    supabaseConfigured: boolean;
    tuturuuuConfigured: boolean;
    googleOAuthConfigured: boolean;
    redisConfigured?: boolean;
    redisReachable?: boolean;
    temporalConfigured?: boolean;
    sentryConfigured?: boolean;
    openTelemetryConfigured?: boolean;
  };
  enterpriseControls?: {
    requestId: {
      enabled: boolean;
      header: string;
    };
    securityHeaders: {
      enabled: boolean;
      headers: string[];
    };
    rateLimit: {
      enabled: boolean;
      storage: string;
      redisConfigured?: boolean;
      redisConnected?: boolean;
      redisLastError?: string | null;
      profiles: Record<string, { max: number; windowMs: number }>;
    };
    searchCache?: {
      enabled: boolean;
      storage: string;
      ttlSeconds: number;
      redisConfigured: boolean;
      redisConnected: boolean;
    };
    auditLogging: {
      enabled: boolean;
      sink: string;
      piiSafe: boolean;
    };
    observability: {
      sentryConfigured: boolean;
      openTelemetryConfigured: boolean;
      redisConfigured: boolean;
      redisReachable?: boolean;
      redisError?: string | null;
      temporalConfigured: boolean;
    };
  };
  worker?: {
    available: boolean;
    ok: boolean;
    status: 'healthy' | 'missing' | 'stale' | 'stopping' | 'unavailable';
    id?: string;
    detail: string;
    lastHeartbeatAt: string | null;
    heartbeatAgeMs: number | null;
    staleAfterMs: number;
  };
  schema: {
    tables: Record<string, { ok: boolean; required: boolean; detail?: string }>;
    indexes: Record<string, { ok: boolean; required: boolean; detail?: string }>;
  };
  indexingOutbox: {
    available: boolean;
    counts: Record<string, number>;
    pendingJobCount?: number;
    dueJobCount?: number;
    staleProcessingCount?: number;
    failedJobCount?: number;
    deadLetterJobCount?: number;
    oldestPendingAgeMs?: number | null;
    detail?: string;
  };
  embeddingIndex?: {
    available: boolean;
    healthy: boolean;
    embeddingModel: string;
    totalChunks: number;
    embeddedChunks: number;
    currentEmbeddingModelChunks: number;
    staleEmbeddingModelChunks: number;
    missingEmbeddingChunks: number;
    latestChunkUpdatedAt: string | null;
    detail?: string;
  };
  warnings: string[];
};

export type IndexingJobStatus = {
  id: string;
  jobType: string;
  sourceType: string;
  sourceId: string;
  status: string;
  retryCount: number;
  maxRetries: number;
  error: string | null;
  lastErrorAt: string | null;
  runAfter: string;
  nextRunAfter: string;
  ageMs: number;
  processingAgeMs: number | null;
  lockedAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IndexingStatus = {
  available: boolean;
  reason?: string;
  counts: Record<string, number>;
  staleProcessingCount: number;
  embeddingIndex?: {
    embeddingModel: string;
    totalChunks: number;
    embeddedChunks: number;
    currentEmbeddingModelChunks: number;
    staleEmbeddingModelChunks: number;
    missingEmbeddingChunks: number;
    latestChunkUpdatedAt: string | null;
    healthy: boolean;
  };
  recent: IndexingJobStatus[];
};

export type RequeueIndexingJobResponse = {
  requeued: boolean;
  reason?: string;
  job?: IndexingJobStatus;
};

export type RequeueDeadLetterResponse = {
  requeued: number;
  status?: string;
  reason?: string;
};

export type DemoReadiness = {
  ready: boolean;
  counts: {
    diaryEntries: number;
    memoryChunks: number;
    summaries: number;
    calendarEvents: number;
    linkedDiaries: number;
    attachments: number;
    extractedAttachments: number;
    pendingOutbox: number;
    failedOutbox: number;
    staleProcessingOutbox?: number;
    currentEmbeddingModelChunks?: number;
    staleEmbeddingModelChunks?: number;
    missingEmbeddingChunks?: number;
  };
  outbox: {
    available: boolean;
    counts: Record<string, number>;
  };
  embeddingIndex?: {
    embeddingModel: string;
    totalChunks: number;
    embeddedChunks: number;
    currentEmbeddingModelChunks: number;
    staleEmbeddingModelChunks: number;
    missingEmbeddingChunks: number;
    latestChunkUpdatedAt: string | null;
    healthy: boolean;
  };
  checks: Array<{
    id: string;
    label: string;
    ok: boolean;
    required: boolean;
    detail: string;
  }>;
  nextActions: string[];
};

export async function getAdminDiagnostics(accessToken: string | null): Promise<AdminDiagnostics> {
  const response = await authFetch('/api/admin/diagnostics', {
    method: 'GET',
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch admin diagnostics' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getIndexingStatus(
  accessToken: string | null,
): Promise<IndexingStatus> {
  const response = await authFetch('/api/indexing/status', {
    method: 'GET',
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch indexing status' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getDemoReadiness(
  accessToken: string | null,
): Promise<DemoReadiness> {
  const response = await authFetch('/api/indexing/demo-readiness', {
    method: 'GET',
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch demo readiness' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function requeueIndexingJob(
  accessToken: string | null,
  jobId: string,
): Promise<RequeueIndexingJobResponse> {
  const response = await authFetch(`/api/indexing/jobs/${jobId}/requeue`, {
    method: 'POST',
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to requeue indexing job' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function requeueDeadLetterIndexingJobs(
  accessToken: string | null,
): Promise<RequeueDeadLetterResponse> {
  const response = await authFetch('/api/indexing/jobs/requeue-dead-letter', {
    method: 'POST',
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to requeue dead-letter indexing jobs' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// ── Search History API ──────────────────────────────────────────────

export type SearchHistoryEntry = {
  id: string;
  question: string;
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  response_language: string;
  token_count: number;
  created_at: string;
  expires_at: string;
};

export async function getSearchHistory(
  accessToken: string | null,
): Promise<SearchHistoryEntry[]> {
  const response = await authFetch('/api/search/history', {
    method: 'GET',
  }, accessToken);

  if (!response.ok) {
    throw new Error('Failed to fetch search history');
  }

  return response.json();
}

export async function deleteSearchHistoryItem(
  id: string,
  accessToken: string | null,
): Promise<void> {
  const response = await authFetch(`/api/search/history/${id}`, {
    method: 'DELETE',
  }, accessToken);

  if (!response.ok) {
    throw new Error('Failed to delete search history item');
  }
}

export async function clearSearchHistory(
  accessToken: string | null,
): Promise<void> {
  const response = await authFetch('/api/search/history', {
    method: 'DELETE',
  }, accessToken);

  if (!response.ok) {
    throw new Error('Failed to clear search history');
  }
}
