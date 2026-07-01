import assert from "node:assert/strict";
import { test } from "node:test";
import { indexMemoryFromAttachment } from "./attachment-indexer.ts";
import type { PersistedMemoryChunkPayload } from "./memory-indexer.ts";

test("indexMemoryFromAttachment persists attachment chunks without using diary as the source", async () => {
  const inserted: PersistedMemoryChunkPayload[][] = [];

  const result = await indexMemoryFromAttachment({
    userId: "user-1",
    attachmentId: "attachment-1",
    diaryEntryId: "diary-1",
    extractedText: "The uploaded PDF says mentor Linh asked us to shorten onboarding copy.",
    occurredAt: new Date("2026-05-18T09:00:00.000Z"),
    sourceTitle: "mentor-notes.pdf",
    fileType: "application/pdf",
    embeddingProvider: {
      embedDocument: async () => [0.1, 0.2, 0.3],
    },
    insertChunks: async (chunks) => {
      inserted.push(chunks);
    },
  });

  assert.equal(result.sourceType, "attachment");
  assert.equal(result.sourceId, "attachment-1");
  assert.equal(result.chunkCount, 1);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0][0].sourceType, "attachment");
  assert.equal(inserted[0][0].sourceId, "attachment-1");
  assert.equal(inserted[0][0].metadata.sourceType, "attachment");
  assert.equal(inserted[0][0].metadata.sourceId, "attachment-1");
  assert.equal(inserted[0][0].metadata.diaryEntryId, "diary-1");
  assert.equal(inserted[0][0].metadata.fileType, "application/pdf");
  assert.notEqual(inserted[0][0].sourceType, "diary");
});

test("indexMemoryFromAttachment splits long extracted text into multiple stable chunks", async () => {
  const inserted: PersistedMemoryChunkPayload[][] = [];
  const longText = Array.from({ length: 80 }, (_, index) =>
    `Sentence ${index + 1} records a useful attachment detail for retrieval.`,
  ).join(" ");

  const result = await indexMemoryFromAttachment({
    userId: "user-1",
    attachmentId: "attachment-2",
    extractedText: longText,
    embeddingProvider: {
      embedDocument: async (text) => [text.length],
    },
    insertChunks: async (chunks) => {
      inserted.push(chunks);
    },
  });

  assert.ok(result.chunkCount > 1);
  assert.deepEqual(
    inserted[0].map((chunk) => chunk.chunkIndex),
    Array.from({ length: result.chunkCount }, (_, index) => index),
  );
  assert.ok(inserted[0].every((chunk) => chunk.sourceType === "attachment"));
});
