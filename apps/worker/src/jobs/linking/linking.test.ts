import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractKeywords } from './linking-utils.ts';

test('extractKeywords removes short Vietnamese stop words and keeps useful terms', () => {
  const keywords = extractKeywords('Tôi có lịch họp Capstone Mentor Review với Linh');

  assert.ok(keywords.includes('capstone'));
  assert.ok(keywords.includes('mentor'));
  assert.ok(keywords.includes('review'));
  assert.equal(keywords.includes('với'), false);
  assert.equal(keywords.includes('có'), false);
});

test('extractKeywords returns an empty list for empty text', () => {
  assert.deepEqual(extractKeywords(''), []);
});
