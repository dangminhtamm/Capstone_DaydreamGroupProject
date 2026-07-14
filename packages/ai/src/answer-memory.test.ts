import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import {
  answerMemory,
  answerFromChunks,
  answerSingleDayFastPath,
  answerTemporalRangeFastPath,
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

test("answerFromChunks falls back to retrieved sources when model output validation fails", async () => {
  const result = await answerFromChunks(
    "Tháng 6 tôi làm gì?",
    [
      makeHit({
        id: "june-plan",
        sourceType: "diary",
        chunkType: "action_item",
        text: "In June I worked on the capstone API, worker, and search experience.",
        evidence: "worked on the capstone API, worker, and search experience",
        similarity: 0.82,
        vectorSimilarity: 0.82,
        occurredAt: new Date("2026-06-15T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      generateAnswer: async () => {
        throw new z.ZodError([
          {
            code: "invalid_value",
            values: ["high", "medium", "low"],
            path: ["confidence"],
            message: "Invalid option",
          },
        ]);
      },
    },
  );

  assert.equal(result.modelError?.kind, "validation");
  assert.equal(result.citations.length, 1);
  assert.match(result.answer, /capstone API/);
});

test("answerFromChunks normalizes loose Gemini JSON formats", async () => {
  const result = await answerFromChunks(
    "Tháng 6 tôi làm gì?",
    [
      makeHit({
        id: "june-plan",
        sourceType: "diary",
        chunkType: "general",
        text: "In June I worked on the capstone API and improved the memory search experience.",
        evidence: "worked on the capstone API and improved the memory search experience",
        similarity: 0.84,
        vectorSimilarity: 0.84,
        occurredAt: new Date("2026-06-12T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      generateAnswer: async (options: any) => ({
        data: options.validator.parse({
          answer: ["Bạn đã làm capstone API và cải thiện memory search experience."],
          confidence: "cao",
          citations: {
            "[S1]": "worked on the capstone API and improved the memory search experience",
          },
        }),
        tokenUsage: {
          promptTokens: 10,
          completionTokens: 8,
          totalTokens: 18,
          model: "test-model",
        },
      }),
    },
  );

  assert.equal(result.analytics?.status, "success");
  assert.equal(result.answerMode, "gemini");
  assert.equal(result.analytics?.answerMode, "gemini");
  assert.equal(result.modelError, undefined);
  assert.equal(result.confidence, "medium");
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0]?.marker, "S1");
  assert.match(result.answer, /capstone API/);
});

test("answerFromChunks accepts insufficient model answers without forcing citations", async () => {
  const result = await answerFromChunks(
    "Phân tích cảm xúc/tâm trạng của tôi trong tuần này dựa trên diary entries.",
    [
      makeHit({
        id: "empty-diary-template",
        sourceType: "diary",
        chunkType: "general",
        text: "Diary template: today I worked on ... mood ... notes ...",
        evidence: "Diary template with no concrete mood information",
        similarity: 0.8,
        vectorSimilarity: 0.8,
        occurredAt: new Date("2026-07-12T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      generateAnswer: async (options: any) => ({
        data: options.validator.parse({
          answer: "Dựa trên các mục nhật ký được cung cấp, không có thông tin cụ thể nào về cảm xúc hay tâm trạng của bạn trong tuần này.",
          confidence: "low",
          citations: [],
        }),
        tokenUsage: {
          promptTokens: 20,
          completionTokens: 12,
          totalTokens: 32,
          model: "test-model",
        },
      }),
    },
  );

  assert.equal(result.noMemory, true);
  assert.equal(result.analytics?.status, "no_memory");
  assert.equal(result.answerMode, "gemini");
  assert.equal(result.analytics?.answerMode, "gemini");
  assert.equal(result.analytics?.tokenUsage.totalTokens, 32);
  assert.equal(result.citations.length, 0);
  assert.match(result.answer, /không có thông tin cụ thể/);
});

test("answerFromChunks treats malformed Gemini JSON as validation fallback", async () => {
  const result = await answerFromChunks(
    "Phân tích cảm xúc/tâm trạng của tôi trong tuần này dựa trên diary entries.",
    [
      makeHit({
        id: "week-note",
        sourceType: "diary",
        chunkType: "general",
        text: "This week I felt stressed about the capstone demo but relieved after fixing search.",
        evidence: "felt stressed about the capstone demo but relieved after fixing search",
        similarity: 0.84,
        vectorSimilarity: 0.84,
        occurredAt: new Date("2026-07-12T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      generateAnswer: async () => {
        throw new Error('Gemini returned invalid JSON that could not be repaired: {"answer":"Dựa trên diary entries,');
      },
    },
  );

  assert.equal(result.modelError?.kind, "validation");
  assert.equal(result.answerMode, "extractive_fallback");
  assert.equal(result.analytics?.answerMode, "extractive_fallback");
  assert.equal(
    result.modelError?.message,
    "Generated answer JSON was invalid and could not be parsed safely.",
  );
  assert.equal(result.citations.length, 1);
  assert.doesNotMatch(result.answer, /Gemini|invalid JSON|could not be repaired/i);
});

test("answerFromChunks uses extractive fallback when model citations are unusable", async () => {
  const result = await answerFromChunks(
    "Tháng 6 tôi làm gì?",
    [
      makeHit({
        id: "june-plan",
        sourceType: "diary",
        chunkType: "general",
        text: "In June I worked on the API build pipeline, worker indexing, and search UX.",
        evidence: "worked on the API build pipeline, worker indexing, and search UX",
        similarity: 0.83,
        vectorSimilarity: 0.83,
        occurredAt: new Date("2026-06-18T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      generateAnswer: async (options: any) => ({
        data: options.validator.parse({
          answer: "Bạn đã làm nhiều việc trong tháng 6.",
          confidence: "",
          citations: [],
        }),
        tokenUsage: {
          promptTokens: 12,
          completionTokens: 6,
          totalTokens: 18,
          model: "test-model",
        },
      }),
    },
  );

  assert.equal(result.analytics?.status, "success");
  assert.equal(result.modelError?.kind, "validation");
  assert.equal(result.answerMode, "extractive_fallback");
  assert.equal(result.citations.length, 1);
  assert.match(result.answer, /API build pipeline/);
});

test("answerFromChunks returns a natural source-based answer when Gemini quota is exhausted", async () => {
  const result = await answerFromChunks(
    "Tháng 6 tôi làm gì?",
    [
      makeHit({
        id: "june-plan",
        sourceType: "diary",
        chunkType: "general",
        text: "In June I worked on the API build pipeline, worker indexing, and search UX.",
        evidence: "worked on the API build pipeline, worker indexing, and search UX",
        similarity: 0.83,
        vectorSimilarity: 0.83,
        occurredAt: new Date("2026-06-18T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      generateAnswer: async () => {
        const error = new Error("429 current quota exceeded");
        (error as Error & { status?: number }).status = 429;
        throw error;
      },
    },
  );

  assert.equal(result.analytics?.status, "success");
  assert.equal(result.modelError?.kind, "quota");
  assert.match(result.answer, /trả lời nhanh bằng các ký ức liên quan|ký ức liên quan đã tìm được/);
  assert.match(result.answer, /API build pipeline/);
});

test("answerTemporalRangeFastPath answers month range questions without generation", () => {
  const result = answerTemporalRangeFastPath(
    "Tháng 6 tôi làm gì?",
    [
      makeHit({
        id: "june-plan",
        sourceType: "diary",
        sourceId: "diary-june-1",
        chunkType: "general",
        text: "In June I improved the search UX and prepared the demo script.",
        evidence: "improved the search UX and prepared the demo script",
        similarity: 0.83,
        vectorSimilarity: 0.83,
        occurredAt: new Date("2026-06-18T00:00:00.000Z"),
      }),
      makeHit({
        id: "june-worker",
        sourceType: "summary",
        sourceId: "summary-june",
        chunkType: "reflection",
        text: "The team also hardened worker indexing and Calendar linking.",
        evidence: "hardened worker indexing and Calendar linking",
        similarity: 0.78,
        vectorSimilarity: 0.78,
        occurredAt: new Date("2026-06-24T00:00:00.000Z"),
      }),
    ],
    {
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: new Date("2026-06-30T23:59:59.999Z"),
    },
    "vi",
    0.62,
  );

  assert.ok(result);
  assert.equal(result.analytics?.tokenUsage.model, "temporal-fast-path");
  assert.equal(result.answerMode, "fast_path");
  assert.equal(result.analytics?.answerMode, "fast_path");
  assert.equal(result.analytics?.timing.generateMs, 0);
  assert.match(result.answer, /trong 01\/06\/2026 đến 30\/06\/2026/);
  assert.match(result.answer, /search UX/);
  assert.equal(result.citations.length, 2);
});

test("answerFromChunks fast strategy returns extractive answer without generation", async () => {
  let generateCalled = false;
  const result = await answerFromChunks(
    "Phân tích nhanh capstone của tôi",
    [
      makeHit({
        id: "capstone-fast",
        sourceType: "diary",
        chunkType: "general",
        text: "I felt focused while polishing capstone search sources and memory answers.",
        evidence: "felt focused while polishing capstone search sources and memory answers",
        similarity: 0.84,
        vectorSimilarity: 0.84,
        occurredAt: new Date("2026-07-12T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      answerStrategy: "fast",
      generateAnswer: async () => {
        generateCalled = true;
        throw new Error("should not generate in fast strategy");
      },
    },
  );

  assert.equal(generateCalled, false);
  assert.equal(result.answerMode, "fast_path");
  assert.equal(result.analytics?.tokenUsage.totalTokens, 0);
  assert.match(result.answer, /trả lời nhanh/);
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
  assert.equal(result.answerMode, "fast_path");
  assert.equal(result.analytics?.answerMode, "fast_path");
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

test("answerMemory answers single-day questions from unindexed diary rows without model generation", async () => {
  const fakeDb = {
    $queryRawUnsafe: async () => [
      {
        id: "diary-today",
        raw_text:
          "Nhật ký hôm nay\n\nHôm nay tôi đi ăn với Dung và Lâm. Tôi cố gắng fix cho xong project capstone, sau đó đi ngủ.",
        entry_date: new Date("2026-07-13T05:00:00.000Z"),
        created_at: new Date("2026-07-13T06:34:17.594Z"),
        job_status: "pending",
      },
    ],
  };

  const result = await answerMemory("Hôm nay tôi đã làm gì?", "user-1", fakeDb as any, {
    responseLanguage: "vi",
  });

  assert.equal(result.analytics?.tokenUsage.model, "unindexed-diary-fast-path");
  assert.equal(result.analytics?.timing.generateMs, 0);
  assert.match(result.answer, /Dung và Lâm/);
  assert.equal(result.citations[0]?.sourceId, "diary-today");
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
