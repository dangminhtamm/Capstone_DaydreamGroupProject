import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isAudioMimeType,
  transcribeAudioChunks,
} from './attachment-extraction.ts';

test('isAudioMimeType recognizes supported browser and mobile audio formats', () => {
  assert.equal(isAudioMimeType('audio/mpeg'), true);
  assert.equal(isAudioMimeType('audio/mp4'), true);
  assert.equal(isAudioMimeType('audio/x-m4a'), true);
  assert.equal(isAudioMimeType('audio/wav'), true);
  assert.equal(isAudioMimeType('application/pdf'), false);
});

test('transcribeAudioChunks sends ordered requests with unique idempotency keys', async () => {
  const previousApiKey = process.env.TUTURUUU_AI_API_KEY;
  const previousBaseUrl = process.env.TUTURUUU_AI_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requests: Array<{ body: any; headers: Record<string, string> }> = [];

  process.env.TUTURUUU_AI_API_KEY = 'test-key';
  process.env.TUTURUUU_AI_BASE_URL = 'https://unit.test/v1';
  globalThis.fetch = (async (_url, init) => {
    requests.push({
      body: JSON.parse(String(init?.body)),
      headers: init?.headers as Record<string, string>,
    });
    return new Response(JSON.stringify({
      output_text: `Transcript ${requests.length}`,
      model: 'google/gemini-3.5-flash-lite',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const transcript = await transcribeAudioChunks({
      attachmentId: 'attachment-1',
      fileName: 'meeting.m4a',
      maxOutputTokens: 1200,
      chunks: [
        { buffer: Buffer.from('part-one'), mimeType: 'audio/mpeg' },
        { buffer: Buffer.from('part-two'), mimeType: 'audio/mpeg' },
      ],
    });

    assert.equal(transcript, 'Transcript 1\n\nTranscript 2');
    assert.equal(requests.length, 2);
    assert.equal(
      requests[0]?.headers['Idempotency-Key'],
      'attachment-transcription-attachment-1-part-1',
    );
    assert.equal(
      requests[1]?.headers['Idempotency-Key'],
      'attachment-transcription-attachment-1-part-2',
    );
    assert.equal(
      requests[0]?.body.input[0].content[1].filename,
      'meeting.part-0001.m4a',
    );
    assert.match(requests[1]?.body.input[0].content[0].text, /segment 2 of 2/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) delete process.env.TUTURUUU_AI_API_KEY;
    else process.env.TUTURUUU_AI_API_KEY = previousApiKey;
    if (previousBaseUrl === undefined) delete process.env.TUTURUUU_AI_BASE_URL;
    else process.env.TUTURUUU_AI_BASE_URL = previousBaseUrl;
  }
});
