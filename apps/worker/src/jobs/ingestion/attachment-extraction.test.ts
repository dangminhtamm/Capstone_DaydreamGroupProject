import assert from 'node:assert/strict';
import test from 'node:test';
import { isAudioMimeType } from './attachment-extraction.ts';

test('isAudioMimeType recognizes supported browser and mobile audio formats', () => {
  assert.equal(isAudioMimeType('audio/mpeg'), true);
  assert.equal(isAudioMimeType('audio/mp4'), true);
  assert.equal(isAudioMimeType('audio/x-m4a'), true);
  assert.equal(isAudioMimeType('audio/wav'), true);
  assert.equal(isAudioMimeType('application/pdf'), false);
});
