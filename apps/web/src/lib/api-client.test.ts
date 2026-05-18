import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const originalFetch = globalThis.fetch;
const apiClientUrl = new URL('./api-client.ts', import.meta.url).href;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('createDiaryEntry sends the Supabase bearer token to the API', async () => {
  const { createDiaryEntry } = await import(apiClientUrl);
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;

    return new Response(
      JSON.stringify({
        id: 'diary-1',
        title: 'Title',
        content: 'Content',
        createdAt: '2026-05-18T00:00:00.000Z',
        updatedAt: '2026-05-18T00:00:00.000Z',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const result = await createDiaryEntry(
    { title: 'Title', content: 'Content' },
    'jwt-token',
  );

  expectUrl(capturedUrl, '/api/diary');
  assert.equal(capturedInit?.method, 'POST');
  assert.equal(
    (capturedInit?.headers as Record<string, string>).Authorization,
    'Bearer jwt-token',
  );
  assert.equal(capturedInit?.body, JSON.stringify({ title: 'Title', content: 'Content' }));
  assert.equal(result.id, 'diary-1');
});

test('getDiaryEntries throws the backend error message when fetch fails', async () => {
  const { getDiaryEntries } = await import(apiClientUrl);
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });

  await assert.rejects(
    () => getDiaryEntries('bad-token'),
    /Unauthorized/,
  );
});

function expectUrl(actual: string, expectedPath: string) {
  const url = new URL(actual);
  assert.equal(url.pathname, expectedPath);
}
