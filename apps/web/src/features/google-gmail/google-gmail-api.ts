import type {
  GmailConnectionStatus,
  GmailMessage,
  GmailSyncResult,
} from './google-gmail-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const error = await response.json();
    const message = error?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string' && message.trim()) return message;
    return fallback || `HTTP ${response.status}`;
  } catch {
    return fallback || `HTTP ${response.status}`;
  }
}

function authFetch(endpoint: string, options: RequestInit, accessToken: string | null): Promise<Response> {
  if (!accessToken) {
    return Promise.reject(new Error('Your session has expired. Please sign in again.'));
  }

  return fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
}

export async function fetchGmailStatus(accessToken: string | null): Promise<GmailConnectionStatus> {
  const response = await authFetch('/api/gmail/status', { method: 'GET' }, accessToken);
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch Gmail status'));
  }
  return response.json();
}

export async function fetchGmailMessages(accessToken: string | null): Promise<GmailMessage[]> {
  const response = await authFetch('/api/gmail/messages', { method: 'GET' }, accessToken);
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch Gmail messages'));
  }

  const data = await response.json() as { messages?: GmailMessage[] };
  return data.messages ?? [];
}

export async function syncGmailMessages(accessToken: string | null, limit?: number): Promise<GmailSyncResult> {
  const query = limit ? `?${new URLSearchParams({ limit: String(limit) })}` : '';
  const response = await authFetch(`/api/gmail/sync${query}`, { method: 'POST' }, accessToken);
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to sync Gmail'));
  }
  return response.json();
}
