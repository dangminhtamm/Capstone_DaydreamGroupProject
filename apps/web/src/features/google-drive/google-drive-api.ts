import type {
  DriveConnectionStatus,
  DriveSyncResult,
  GoogleDriveFile,
} from './google-drive-types';

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

export async function fetchDriveStatus(accessToken: string | null): Promise<DriveConnectionStatus> {
  const response = await authFetch('/api/drive/status', { method: 'GET' }, accessToken);
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch Google Drive status'));
  }
  return response.json();
}

export async function fetchDriveFiles(accessToken: string | null): Promise<GoogleDriveFile[]> {
  const response = await authFetch('/api/drive/files', { method: 'GET' }, accessToken);
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch Google Drive files'));
  }

  const data = await response.json() as {
    files?: Array<{
      id: string;
      name: string;
      mime_type: string;
      web_view_link?: string | null;
      icon_link?: string | null;
      thumbnail_link?: string | null;
      modified_time?: string | null;
    }>;
  };

  return (data.files ?? []).map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mime_type,
    webViewLink: file.web_view_link ?? null,
    iconLink: file.icon_link ?? null,
    thumbnailLink: file.thumbnail_link ?? null,
    modifiedTime: file.modified_time ?? null,
  }));
}

export async function syncDriveFiles(accessToken: string | null, limit?: number): Promise<DriveSyncResult> {
  const query = limit ? `?${new URLSearchParams({ limit: String(limit) })}` : '';
  const response = await authFetch(`/api/drive/sync${query}`, { method: 'POST' }, accessToken);
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to sync Google Drive'));
  }
  return response.json();
}
