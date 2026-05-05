import 'dotenv/config';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const ACCESS_TOKEN = process.env.TEST_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('Missing TEST_ACCESS_TOKEN env var. Grab the Supabase access token and set TEST_ACCESS_TOKEN before running.');
  process.exit(1);
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    console.error('Request failed', {
      status: response.status,
      statusText: response.statusText,
      payload,
    });
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }

  return payload as T;
}

async function getDiaryEntries() {
  const entries = await authFetch<any[]>('/diary', { method: 'GET' });
  console.log('Fetched entries:', entries);
}

async function createDiaryEntry(title: string, content: string) {
  const body = JSON.stringify({ title, content });
  const entry = await authFetch('/diary', {
    method: 'POST',
    body,
  });
  console.log('Created entry:', entry);
}

async function main() {
  await getDiaryEntries();
  await createDiaryEntry('CLI test entry', `Created at ${new Date().toISOString()}`);
  await getDiaryEntries();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
