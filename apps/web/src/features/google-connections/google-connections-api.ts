const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type GoogleDisconnectResult = {
  disconnected: boolean;
  deleteSyncedData: boolean;
  revoke: {
    attempted: boolean;
    revoked: boolean;
    reason: string | null;
  };
  deletedCounts: {
    calendarEvents: number;
    gmailMessages: number;
    driveFiles: number;
    contacts: number;
    memoryChunks: number;
    indexingJobs: number;
  };
  message: string;
};

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

export async function disconnectGoogle(
  accessToken: string | null,
  options: { deleteSyncedData?: boolean } = {},
): Promise<GoogleDisconnectResult> {
  if (!accessToken) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const response = await fetch(`${API_URL}/api/google/disconnect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      deleteSyncedData: options.deleteSyncedData === true,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to disconnect Google.'));
  }

  return response.json();
}
