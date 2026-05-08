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
  const response = await authFetch('/diary', {
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
  const response = await authFetch('/diary', {
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
  const response = await authFetch(`/diary/${id}`, {
    method: 'GET',
  }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch diary entry' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Search API — calls GET /search?q=... (authenticated)
type SearchQueryPayload = {
  question: string;
};

type SearchResult = {
  answer: string;
  sources: string[];
};

export async function askSearch(
  payload: SearchQueryPayload,
  accessToken: string | null
): Promise<SearchResult> {
  const params = new URLSearchParams({ q: payload.question });
  const response = await authFetch(`/search?${params.toString()}`, { method: 'GET' }, accessToken);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Search failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  // Backend returns { count, results: DiaryEntry[] } — shape into answer/sources
  const results: DiaryEntry[] = data.results ?? [];
  const answer =
    results.length > 0
      ? `Found ${results.length} entr${results.length === 1 ? 'y' : 'ies'} matching your query.`
      : 'No diary entries matched your query.';
  const sources = results.map(
    (e) => `${e.title} — ${new Date(e.createdAt).toLocaleDateString()}`
  );

  return { answer, sources };
}
