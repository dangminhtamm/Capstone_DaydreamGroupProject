import assert from "node:assert/strict";
import { test } from "node:test";
import {
  answerFromChunks,
  answerSingleDayFastPath,
  inferRetrievalFilters,
} from "./answer-memory.ts";
import type { MemorySearchHit } from "./retrieval.ts";

test("inferRetrievalFilters prefers calendar sources for calendar questions", () => {
  const filters = inferRetrievalFilters("When was the Backend API Check scheduled?");

  assert.deepEqual(filters.preferredSourceTypes, ["calendar"]);
  assert.ok(filters.preferredChunkTypes?.includes("event"));
});

test("inferRetrievalFilters prefers action-item chunks for task questions", () => {
  const filters = inferRetrievalFilters("What remaining tasks do I need to follow up on?");

  assert.deepEqual(filters.preferredSourceTypes, ["diary"]);
  assert.ok(filters.preferredChunkTypes?.includes("action_item"));
});

test("answerFromChunks does not attach citations when top similarity is too low", async () => {
  const result = await answerFromChunks(
    "What did I do today?",
    [
      makeHit({
        similarity: 0.2,
        text: "A weakly related memory",
      }),
    ],
    { minTopSimilarity: 0.55 },
  );

  assert.equal(result.confidence, "low");
  assert.equal(result.citations.length, 0);
});

test("answerFromChunks rejects lexical-only hits without semantic support", async () => {
  const result = await answerFromChunks(
    "What did I decide about pricing?",
    [
      makeHit({
        similarity: 0.85,
        vectorSimilarity: 0,
        lexicalScore: 0.95,
        retrievalMode: "lexical",
        text: "Pricing was mentioned in an unrelated note.",
      }),
    ],
    { minTopSimilarity: 0.62 },
  );

  assert.equal(result.confidence, "low");
  assert.equal(result.noMemory, true);
  assert.equal(result.citations.length, 0);
});

test("answerSingleDayFastPath assembles simple day answers without model generation", () => {
  const result = answerSingleDayFastPath(
    "What did I do on 2026-05-18?",
    [
      makeHit({
        id: "chunk-1",
        text: "I went to a cafe to study today.",
        similarity: 0.7,
        vectorSimilarity: 0.7,
      }),
      makeHit({
        id: "chunk-2",
        text: "After studying, I went home to sleep.",
        similarity: 0.68,
        vectorSimilarity: 0.68,
      }),
    ],
    {
      startDate: new Date("2026-05-18T00:00:00.000Z"),
      endDate: new Date("2026-05-18T23:59:59.999Z"),
    },
    "en",
    0.62,
  );

  assert.ok(result);
  assert.equal(result.analytics?.tokenUsage.model, "fast-path");
  assert.equal(result.analytics?.timing.generateMs, 0);
  assert.equal(result.citations.length, 2);
  assert.match(result.answer, /I went to a cafe to study today/);
});

test("answerSingleDayFastPath skips reasoning-heavy temporal questions", () => {
  const result = answerSingleDayFastPath(
    "Compare how I felt on 2026-05-18",
    [
      makeHit({
        text: "I felt tired after studying.",
        similarity: 0.72,
        vectorSimilarity: 0.72,
      }),
    ],
    {
      startDate: new Date("2026-05-18T00:00:00.000Z"),
      endDate: new Date("2026-05-18T23:59:59.999Z"),
    },
    "en",
    0.62,
  );

  assert.equal(result, null);
});

test("inferRetrievalFilters parses relative temporal ranges", () => {
  const filters = inferRetrievalFilters("What happened last week?");

  assert.ok(filters.startDate instanceof Date);
  assert.ok(filters.endDate instanceof Date);
  assert.ok(filters.endDate.getTime() > filters.startDate.getTime());
});

test("inferRetrievalFilters parses explicit month intent", () => {
  const filters = inferRetrievalFilters("What happened last March?");

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.getUTCMonth(), 2);
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.getUTCMonth(), 2);
  assert.equal(filters.endDate.getUTCDate(), 31);
});

test("inferRetrievalFilters parses Vietnamese numeric day/month dates", () => {
  const filters = inferRetrievalFilters("Tôi ghi nhật ký ngày 18/5 như thế nào?");

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.toISOString(), "2026-05-18T00:00:00.000Z");
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.toISOString(), "2026-05-18T23:59:59.999Z");
  assert.deepEqual(filters.preferredSourceTypes, ["diary"]);
});

test("inferRetrievalFilters parses Vietnamese written day/month dates", () => {
  const filters = inferRetrievalFilters("Ngày 18 tháng 5 tôi đã làm gì?");

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.toISOString(), "2026-05-18T00:00:00.000Z");
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.toISOString(), "2026-05-18T23:59:59.999Z");
});

test("inferRetrievalFilters parses ISO dates", () => {
  const filters = inferRetrievalFilters("What happened on 2026-05-18?");

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.toISOString(), "2026-05-18T00:00:00.000Z");
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.toISOString(), "2026-05-18T23:59:59.999Z");
});

function makeHit(overrides: Partial<MemorySearchHit>): MemorySearchHit {
  return {
    id: "chunk-1",
    sourceType: "diary",
    sourceId: "diary-1",
    chunkType: "general",
    text: "Memory text",
    evidence: null,
    metadata: {},
    occurredAt: new Date("2026-05-18T09:00:00.000Z"),
    distance: 0.8,
    vectorSimilarity: 0.2,
    lexicalScore: 0,
    retrievalMode: "vector",
    similarity: 0.2,
    ...overrides,
  };
}
