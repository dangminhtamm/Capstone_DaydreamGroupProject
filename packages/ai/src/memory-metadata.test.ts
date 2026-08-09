import assert from "node:assert/strict";
import test from "node:test";
import { withMemoryDate, type MemoryChunkMetadata } from "./types.ts";

test("withMemoryDate mirrors date into memoryDate for new memory chunks", () => {
  const metadata = withMemoryDate({
    date: "2026-08-09T05:00:00.000Z",
    sourceType: "diary",
    sourceId: "diary-1",
    chunkIndex: 0,
    chunkType: "general",
  } satisfies MemoryChunkMetadata);

  assert.equal(metadata.date, "2026-08-09T05:00:00.000Z");
  assert.equal(metadata.memoryDate, "2026-08-09T05:00:00.000Z");
});

test("withMemoryDate preserves explicit memoryDate while backfilling date", () => {
  const metadata = withMemoryDate({
    date: null,
    memoryDate: "2026-08-09T05:00:00.000Z",
    sourceType: "summary",
    sourceId: "summary-1",
    chunkIndex: 0,
    chunkType: "reflection",
  } satisfies MemoryChunkMetadata);

  assert.equal(metadata.date, "2026-08-09T05:00:00.000Z");
  assert.equal(metadata.memoryDate, "2026-08-09T05:00:00.000Z");
});
