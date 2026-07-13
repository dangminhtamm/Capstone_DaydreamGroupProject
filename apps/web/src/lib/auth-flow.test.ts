import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { Session } from '@supabase/supabase-js';
import { getAuthCallbackUrl, syncSessionWithBackend } from './auth-flow.ts';

const originalFetch = globalThis.fetch;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
  if (originalApiUrl === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  }
});

test('getAuthCallbackUrl uses configured public site URL', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000/';

  assert.equal(getAuthCallbackUrl(), 'http://localhost:3000/auth/callback');
  assert.equal(getAuthCallbackUrl('recovery'), 'http://localhost:3000/auth/callback?type=recovery');
});

test('syncSessionWithBackend posts the Supabase bearer token', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  await syncSessionWithBackend({
    access_token: 'supabase-jwt',
    user: {
      user_metadata: { full_name: 'Demo User' },
    },
  } as Session);

  assert.equal(capturedUrl, 'http://localhost:3001/api/auth/sync');
  assert.equal(capturedInit?.method, 'POST');
  assert.equal(
    (capturedInit?.headers as Record<string, string>).Authorization,
    'Bearer supabase-jwt',
  );
  assert.equal(capturedInit?.body, JSON.stringify({ display_name: 'Demo User' }));
});
