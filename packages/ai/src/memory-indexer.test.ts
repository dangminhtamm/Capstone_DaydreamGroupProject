import assert from "node:assert/strict";
import test from "node:test";
import {
  indexMemoryFromDiary,
  type PersistedMemoryChunkPayload,
} from "./memory-indexer.ts";

test("diary indexing persists lexical chunks when chunking and embedding services fail", async () => {
  const inserted: PersistedMemoryChunkPayload[] = [];
  const fallbackErrors: string[] = [];

  const result = await indexMemoryFromDiary({
    userId: "user-1",
    diaryId: "diary-1",
    rawText: "I reviewed the API and fixed the indexing worker.",
    entryDate: "2026-08-14T10:00:00.000Z",
    chunkingOptions: {
      generateWithModel: async () => {
        throw new Error("chunk model unavailable");
      },
      onFallback: (error) => fallbackErrors.push(error.message),
    },
    embeddingProvider: {
      embedDocument: async () => {
        throw new Error("embedding model unavailable");
      },
    },
    onEmbeddingFallback: (error) => fallbackErrors.push(error.message),
    insertChunks: async (chunks) => {
      inserted.push(...chunks);
    },
  });

  assert.deepEqual(fallbackErrors, [
    "chunk model unavailable",
    "embedding model unavailable",
  ]);
  assert.equal(result.chunkCount, 1);
  assert.equal(result.chunks[0]?.embeddingDimension, 0);
  assert.equal(inserted[0]?.embedding, null);
  assert.equal(inserted[0]?.metadata.chunkingMethod, "deterministic_fallback");
  assert.equal(inserted[0]?.metadata.embeddingStatus, "pending");
  assert.equal(inserted[0]?.text, "I reviewed the API and fixed the indexing worker.");
});
