import assert from "node:assert/strict";
import { test } from "node:test";
import {
  answerFromChunks,
  answerSingleDayFastPath,
  inferRetrievalFilters,
  rerankMemoryHits,
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

test("inferRetrievalFilters narrows recent questions to the last 30 days", () => {
  const filters = inferRetrievalFilters(
    "What did I work on recently?",
    new Date("2026-07-13T15:30:00.000Z"),
  );

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.toISOString(), "2026-06-13T00:00:00.000Z");
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.toISOString(), "2026-07-13T23:59:59.999Z");
});

test("inferRetrievalFilters lets explicit dates override recent intent", () => {
  const filters = inferRetrievalFilters(
    "What was the latest thing on 10/7?",
    new Date("2026-07-13T15:30:00.000Z"),
  );

  assert.equal(filters.startDate?.toISOString(), "2026-07-10T00:00:00.000Z");
  assert.equal(filters.endDate?.toISOString(), "2026-07-10T23:59:59.999Z");
});

test("inferRetrievalFilters prefers attachment sources for document questions", () => {
  const filters = inferRetrievalFilters("What does my uploaded PDF say about the assignment?");

  assert.deepEqual(filters.preferredSourceTypes, ["attachment"]);
  assert.ok(filters.preferredChunkTypes?.includes("general_note"));
});

test("rerankMemoryHits boosts recent primary sources over older summaries", () => {
  const chunks = rerankMemoryHits(
    "What did I work on recently?",
    [
      makeHit({
        id: "summary-old",
        sourceType: "summary",
        chunkType: "reflection",
        text: "Old monthly summary about work.",
        similarity: 0.72,
        vectorSimilarity: 0.72,
        occurredAt: new Date("2026-06-01T00:00:00.000Z"),
      }),
      makeHit({
        id: "diary-new",
        sourceType: "diary",
        chunkType: "action_item",
        text: "I worked on the search UI and citation cards recently.",
        similarity: 0.69,
        vectorSimilarity: 0.69,
        occurredAt: new Date("2026-07-12T00:00:00.000Z"),
      }),
    ],
    { preferredSourceTypes: ["diary"], preferredChunkTypes: ["action_item"] },
  );

  assert.equal(chunks[0].id, "diary-new");
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

test("inferRetrievalFilters parses tomorrow and ngày mai", () => {
  const now = new Date("2026-07-11T15:30:00.000Z");
  const englishFilters = inferRetrievalFilters("What do I have tomorrow?", now);
  const vietnameseFilters = inferRetrievalFilters("Ngày mai tôi có lịch gì?", now);

  assert.ok(englishFilters.startDate instanceof Date);
  assert.equal(englishFilters.startDate.toISOString(), "2026-07-12T00:00:00.000Z");
  assert.ok(englishFilters.endDate instanceof Date);
  assert.equal(englishFilters.endDate.toISOString(), "2026-07-12T23:59:59.999Z");
  assert.deepEqual(vietnameseFilters.preferredSourceTypes, ["calendar"]);
  assert.ok(vietnameseFilters.startDate instanceof Date);
  assert.equal(vietnameseFilters.startDate.toISOString(), "2026-07-12T00:00:00.000Z");
});

test("inferRetrievalFilters parses hôm trước as the previous day", () => {
  const filters = inferRetrievalFilters(
    "Hôm trước tôi đã viết gì trong nhật ký?",
    new Date("2026-07-11T15:30:00.000Z"),
  );

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.toISOString(), "2026-07-10T00:00:00.000Z");
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.toISOString(), "2026-07-10T23:59:59.999Z");
  assert.deepEqual(filters.preferredSourceTypes, ["diary"]);
});

test("inferRetrievalFilters parses next week and tuần sau", () => {
  const now = new Date("2026-07-11T15:30:00.000Z");
  const englishFilters = inferRetrievalFilters("What events are scheduled next week?", now);
  const vietnameseFilters = inferRetrievalFilters("Tuần sau tôi có lịch gì?", now);

  assert.ok(englishFilters.startDate instanceof Date);
  assert.equal(englishFilters.startDate.toISOString(), "2026-07-13T00:00:00.000Z");
  assert.ok(englishFilters.endDate instanceof Date);
  assert.equal(englishFilters.endDate.toISOString(), "2026-07-19T23:59:59.999Z");
  assert.deepEqual(vietnameseFilters.preferredSourceTypes, ["calendar"]);
  assert.ok(vietnameseFilters.startDate instanceof Date);
  assert.equal(vietnameseFilters.startDate.toISOString(), "2026-07-13T00:00:00.000Z");
});

test("inferRetrievalFilters parses next month and tháng sau", () => {
  const now = new Date("2026-07-11T15:30:00.000Z");
  const englishFilters = inferRetrievalFilters("What meetings are next month?", now);
  const vietnameseFilters = inferRetrievalFilters("Tháng sau tôi có sự kiện gì?", now);

  assert.ok(englishFilters.startDate instanceof Date);
  assert.equal(englishFilters.startDate.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.ok(englishFilters.endDate instanceof Date);
  assert.equal(englishFilters.endDate.toISOString(), "2026-08-31T23:59:59.999Z");
  assert.deepEqual(vietnameseFilters.preferredSourceTypes, ["calendar"]);
  assert.ok(vietnameseFilters.startDate instanceof Date);
  assert.equal(vietnameseFilters.startDate.toISOString(), "2026-08-01T00:00:00.000Z");
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
