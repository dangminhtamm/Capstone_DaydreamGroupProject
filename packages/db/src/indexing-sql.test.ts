import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deleteEntityMentionsForSource,
  resolveMemoryChunkIds,
} from '../index.ts';

const source = {
  userId: 'cca496d3-7c4d-48c5-b1a5-fcd2ea0b8faa',
  sourceType: 'diary',
  sourceId: '022b492e-f657-4230-8d94-47ab8b917bb7',
};

test('resolveMemoryChunkIds casts UUID-looking parameters to legacy text columns', async () => {
  let capturedSql = '';
  const prisma = {
    $queryRawUnsafe: async (sql: string) => {
      capturedSql = sql;
      return [];
    },
  };

  await resolveMemoryChunkIds(prisma as any, source);

  assert.match(capturedSql, /"user_id" = \$1::text/);
  assert.match(capturedSql, /"source_id" = \$3::text/);
});

test('deleteEntityMentionsForSource compares chunk IDs as text', async () => {
  let capturedSql = '';
  const prisma = {
    $executeRawUnsafe: async (sql: string) => {
      capturedSql = sql;
      return 0;
    },
  };

  await deleteEntityMentionsForSource(prisma as any, source);

  assert.match(capturedSql, /SELECT "id"::text FROM "memory_chunks"/);
  assert.match(capturedSql, /"user_id" = \$1::text/);
  assert.match(capturedSql, /"source_id" = \$3::text/);
});
