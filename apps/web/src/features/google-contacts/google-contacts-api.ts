import type {
  ContactConnectionStatus,
  ContactSyncResult,
  GoogleContact,
} from './google-contacts-types';

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

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    ...options.headers,
  };

  return fetch(`${API_URL}${endpoint}`, { ...options, headers });
}

export async function fetchContactStatus(accessToken: string | null): Promise<ContactConnectionStatus> {
  const response = await authFetch('/api/contacts/status', { method: 'GET' }, accessToken);
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch Google Contacts status'));
  }
  return response.json();
}

export async function fetchContacts(accessToken: string | null): Promise<GoogleContact[]> {
  const response = await authFetch('/api/contacts/contacts', { method: 'GET' }, accessToken);
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch Google Contacts'));
  }

  const data = await response.json() as {
    contacts?: Array<{
      id: string;
      display_name: string;
      email_addresses: string[];
      phone_numbers: string[];
      organizations: string[];
      photo_url?: string | null;
    }>;
  };

  return (data.contacts ?? []).map((contact) => ({
    id: contact.id,
    displayName: contact.display_name,
    emailAddresses: contact.email_addresses ?? [],
    phoneNumbers: contact.phone_numbers ?? [],
    organizations: contact.organizations ?? [],
    photoUrl: contact.photo_url ?? null,
  }));
}

export async function syncContacts(accessToken: string | null, limit?: number): Promise<ContactSyncResult> {
  const query = limit ? `?${new URLSearchParams({ limit: String(limit) })}` : '';
  const response = await authFetch(`/api/contacts/sync${query}`, { method: 'POST' }, accessToken);
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to sync Google Contacts'));
  }
  return response.json();
}
