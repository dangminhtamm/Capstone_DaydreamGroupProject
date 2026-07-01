const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types - match backend DTO
export type DiaryEntry = {
  id: string;
  title: string;
  content: string;
  attachments?: string[];
  entryDate?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
};

export type CreateDiaryPayload = {
  title: string;
  content: string;
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

// Diary API functions
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
  accessToken: string | null
): Promise<DiaryEntry[]> {
  const response = await authFetch('/api/diary', {
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

export type UpdateDiaryPayload = {
  title?: string;
  content?: string;
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
  url?: string;
  extractionStatus: 'extracted' | 'pending' | 'empty';
  memoryIndexed: boolean;
  memoryChunkCount: number;
  processingError?: string;
  attachment: {
    id: string;
    diaryEntryId: string;
    storagePath: string;
    fileType: string;
    extractedText?: string | null;
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
    const error = await response.json().catch(() => ({ message: 'Failed to upload attachment' }));
    throw new Error(error.message || `HTTP ${response.status}`);
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
    const error = await response.json().catch(() => ({ message: 'Failed to process attachment' }));
    throw new Error(error.message || `HTTP ${response.status}`);
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
    throw new Error("Failed to fetch answer");
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
