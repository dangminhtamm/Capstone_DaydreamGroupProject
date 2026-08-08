import type { Session } from '@supabase/supabase-js';

export type UserRole = 'user' | 'admin';

export type BackendAuthProfile = {
  message: string;
  userId: string;
  role: UserRole;
  isAdmin: boolean;
  googleConnected: boolean;
};

function getPublicSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  if (typeof window === 'undefined') return 'http://localhost:3000';

  if (window.location.origin === 'http://127.0.0.1:3000') {
    return 'http://localhost:3000';
  }

  return window.location.origin;
}

export function getAuthCallbackUrl(type?: 'recovery') {
  const url = new URL('/auth/callback', getPublicSiteUrl());
  if (type) url.searchParams.set('type', type);
  return url.toString();
}

export async function syncSessionWithBackend(session: Session): Promise<BackendAuthProfile> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const displayName = session.user.user_metadata?.full_name || session.user.user_metadata?.name;

  const response = await fetch(`${apiUrl}/api/auth/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ display_name: displayName }),
  });

  if (!response.ok) {
    throw new Error(`Backend auth sync failed with HTTP ${response.status}`);
  }

  return response.json();
}
