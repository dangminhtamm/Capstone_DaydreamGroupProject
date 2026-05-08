const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types - match backend DTO
export type DiaryEntry = {
  id: string;
  title: string;
  content: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
  userId: string;
};

export type CreateDiaryPayload = {
  title: string;
  content: string;
  attachments?: string[];
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
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
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

// Search API (keep existing)
type AskPayload = {
  question: string;
};

type AskResponse = {
  answer: string;
  sources: string[];
};

export async function askSearch(payload: AskPayload): Promise<AskResponse> {
  const response = await fetch(`${API_URL}/api/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch answer");
  }

  return response.json() as Promise<AskResponse>;
}
