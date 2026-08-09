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
import {
  shouldTranslateFastAnswer,
  translateFastAnswerIfUseful,
} from "./answer-memory-translation.ts";
import {
  selectMaxAnswerTokens,
  shouldUseAutoFastPath,
} from "./answer-memory-routing.ts";
import type { AnswerMemoryResult } from "./answer-memory.ts";
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

test("inferRetrievalFilters narrows recent questions to the last 60 days", () => {
  const filters = inferRetrievalFilters(
    "What did I work on recently?",
    new Date("2026-07-13T15:30:00.000Z"),
  );

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.toISOString(), "2026-05-14T00:00:00.000Z");
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.toISOString(), "2026-07-13T23:59:59.999Z");
  assert.equal(filters.allowTemporalFallback, true);
});

test("inferRetrievalFilters treats latest memory questions as recent ranges", () => {
  const filters = inferRetrievalFilters(
    "Summarize my latest diary memories.",
    new Date("2026-07-13T15:30:00.000Z"),
  );

  assert.equal(filters.startDate?.toISOString(), "2026-05-14T00:00:00.000Z");
  assert.equal(filters.endDate?.toISOString(), "2026-07-13T23:59:59.999Z");
  assert.equal(filters.allowTemporalFallback, true);
});

test("inferRetrievalFilters lets explicit dates override recent intent", () => {
  const filters = inferRetrievalFilters(
    "What was the latest thing on 10/7?",
    new Date("2026-07-13T15:30:00.000Z"),
  );

  assert.equal(filters.startDate?.toISOString(), "2026-07-10T00:00:00.000Z");
  assert.equal(filters.endDate?.toISOString(), "2026-07-10T23:59:59.999Z");
});

test("auto routing uses Deep for broad recent work synthesis but Fast for exact dates", () => {
  const recentFilters = inferRetrievalFilters(
    "What did I work on recently?",
    new Date("2026-08-06T15:30:00.000Z"),
  );
  const exactDateFilters = inferRetrievalFilters(
    "What did I work on 9/7?",
    new Date("2026-08-06T15:30:00.000Z"),
  );

  assert.equal(
    shouldUseAutoFastPath("What did I work on recently?", "progress", recentFilters),
    false,
  );
  assert.equal(
    shouldUseAutoFastPath("What did I work on 9/7?", "progress", exactDateFilters),
    true,
  );

  const julyFilters = inferRetrievalFilters(
    "tóm tắt tháng 7 tôi làm gì?",
    new Date("2026-08-06T15:30:00.000Z"),
  );
  assert.equal(
    shouldUseAutoFastPath("tóm tắt tháng 7 tôi làm gì?", "progress", julyFilters),
    false,
  );
  assert.ok(selectMaxAnswerTokens("tóm tắt tháng 7 tôi làm gì?") >= 2048);
});

test("inferRetrievalFilters prefers attachment sources for document questions", () => {
  const filters = inferRetrievalFilters("What does my uploaded PDF say about the assignment?");

  assert.deepEqual(filters.preferredSourceTypes, ["attachment"]);
  assert.ok(filters.preferredChunkTypes?.includes("general_note"));
});

test("inferRetrievalFilters prefers reflection chunks for mood questions", () => {
  const filters = inferRetrievalFilters("Phân tích tâm trạng của tôi tuần này");

  assert.deepEqual(filters.preferredSourceTypes, ["diary", "summary"]);
  assert.ok(filters.preferredChunkTypes?.includes("reflection"));
});

test("inferRetrievalFilters prefers diary and summary context for risk questions", () => {
  const filters = inferRetrievalFilters("What were the main blockers and risks this week?");

  assert.deepEqual(filters.preferredSourceTypes, ["diary", "summary"]);
  assert.ok(filters.preferredChunkTypes?.includes("action_item"));
});

test("inferRetrievalFilters uses broad source context for progress summaries", () => {
  const filters = inferRetrievalFilters("Summarize the team's progress across the week.");

  assert.deepEqual(filters.sourceTypes, ["diary", "calendar", "summary"]);
  assert.deepEqual(filters.preferredSourceTypes, ["diary", "calendar"]);
  assert.ok(filters.preferredChunkTypes?.includes("event"));
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

test("rerankMemoryHits boosts metadata entity matches and importance", () => {
  const chunks = rerankMemoryHits(
    "What feedback did Linh give about Second Brain?",
    [
      makeHit({
        id: "generic-feedback",
        sourceType: "diary",
        chunkType: "feedback",
        text: "A mentor gave general feedback about the demo.",
        similarity: 0.69,
        vectorSimilarity: 0.69,
        metadata: {},
      }),
      makeHit({
        id: "metadata-rich-feedback",
        sourceType: "diary",
        chunkType: "feedback",
        text: "The citation UI should be obvious so evaluators can trust the AI.",
        evidence: "Mentor Linh said the citation UI must be obvious so evaluators can trust the AI.",
        similarity: 0.65,
        vectorSimilarity: 0.65,
        metadata: {
          people: ["Linh"],
          projects: ["Second Brain"],
          importance: 5,
        },
      }),
    ],
    { preferredSourceTypes: ["diary"], preferredChunkTypes: ["feedback"] },
  );

  assert.equal(chunks[0].id, "metadata-rich-feedback");
});

test("rerankMemoryHits penalizes meta question notes for blocker queries", () => {
  const chunks = rerankMemoryHits(
    "What blockers did we have recently?",
    [
      makeHit({
        id: "meta-question-note",
        sourceType: "diary",
        chunkType: "general",
        text: "The best questions are: what feedback did Linh give, what blockers did we have this week, and what made me feel stressed.",
        similarity: 0.76,
        vectorSimilarity: 0.76,
        metadata: { tags: ["demo"] },
        occurredAt: new Date("2026-07-18T00:00:00.000Z"),
      }),
      makeHit({
        id: "actual-blocker",
        sourceType: "diary",
        chunkType: "action_item",
        text: "The main blocker is making sure the worker is running before the final rehearsal. Another risk is Gemini quota during live demo.",
        similarity: 0.67,
        vectorSimilarity: 0.67,
        metadata: { tags: ["risk", "blocker"], importance: 5 },
        occurredAt: new Date("2026-07-11T00:00:00.000Z"),
      }),
    ],
    { preferredSourceTypes: ["diary", "summary"], preferredChunkTypes: ["action_item", "reflection", "general"] },
  );

  assert.equal(chunks[0].id, "actual-blocker");
});

test("rerankMemoryHits boosts Google Contacts plans over generic demo notes", () => {
  const chunks = rerankMemoryHits(
    "What was the future plan for Google Contacts?",
    [
      makeHit({
        id: "demo-ready",
        sourceType: "diary",
        sourceId: "demo-ready",
        chunkType: "general",
        text: "Today the demo account is ready for AI memory testing. We confirmed diary entries and search citations are available.",
        similarity: 0.78,
        vectorSimilarity: 0.78,
        occurredAt: new Date("2026-07-18T00:00:00.000Z"),
      }),
      makeHit({
        id: "contacts-plan",
        sourceType: "diary",
        sourceId: "contacts-plan",
        chunkType: "decision",
        text: "We wrote down a future plan for Google Contacts. The feature would sync contact names, emails, phone numbers, and organizations from Google People API.",
        similarity: 0.66,
        vectorSimilarity: 0.66,
        metadata: { projects: ["Google Contacts"], importance: 5 },
        occurredAt: new Date("2026-07-16T00:00:00.000Z"),
      }),
    ],
  );

  assert.equal(chunks[0].id, "contacts-plan");
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
      answerStrategy: "deep",
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
      answerStrategy: "deep",
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
      answerStrategy: "deep",
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

test("answerFromChunks accepts Vietnamese answers grounded by English citation claims", async () => {
  const result = await answerFromChunks(
    "Điều gì làm tôi căng thẳng tuần này?",
    [
      makeHit({
        id: "stress-note",
        sourceType: "diary",
        chunkType: "reflection",
        text: "This week I felt stressed about the capstone demo but relieved after fixing search.",
        evidence: "felt stressed about the capstone demo",
        similarity: 0.86,
        vectorSimilarity: 0.86,
        occurredAt: new Date("2026-07-12T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      answerStrategy: "deep",
      generateAnswer: async (options: any) => ({
        data: options.validator.parse({
          answer: "Bạn cảm thấy căng thẳng vì buổi demo capstone, rồi nhẹ nhõm hơn sau khi sửa phần search.",
          confidence: "medium",
          citations: [
            {
              marker: "S1",
              claim: "felt stressed about the capstone demo",
            },
          ],
        }),
        tokenUsage: {
          promptTokens: 30,
          completionTokens: 18,
          totalTokens: 48,
          model: "test-model",
        },
      }),
    },
  );

  assert.equal(result.answerMode, "gemini");
  assert.equal(result.analytics?.answerMode, "gemini");
  assert.equal(result.modelError, undefined);
  assert.equal(result.citations.length, 1);
  assert.match(result.answer, /căng thẳng/);
});

test("answerFromChunks recovers citations when Gemini omits them but the answer is supported", async () => {
  const result = await answerFromChunks(
    "What feedback did Linh give about citations?",
    [
      makeHit({
        id: "linh-feedback",
        sourceType: "diary",
        chunkType: "feedback",
        text: "Mentor Linh said the citation UI must be obvious so evaluators can trust the AI.",
        evidence: "Mentor Linh said the citation UI must be obvious",
        similarity: 0.88,
        vectorSimilarity: 0.88,
        occurredAt: new Date("2026-07-12T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "en",
      answerStrategy: "deep",
      generateAnswer: async (options: any) => ({
        data: options.validator.parse({
          answer: "Linh said the citation UI must be obvious so evaluators can trust the AI.",
        }),
        tokenUsage: {
          promptTokens: 22,
          completionTokens: 12,
          totalTokens: 34,
          model: "test-model",
        },
      }),
    },
  );

  assert.equal(result.modelError, undefined);
  assert.equal(result.answerMode, "gemini");
  assert.equal(result.analytics?.answerMode, "gemini");
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0]?.sourceId, "diary-1");
  assert.match(result.answer, /citation UI must be obvious/);
  assert.doesNotMatch(result.answer, /invalid_type|nonoptional|undefined/i);
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
      answerStrategy: "deep",
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

test("answerFromChunks rejects incomplete generated answers even when citations parse", async () => {
  const result = await answerFromChunks(
    "What made me feel stressed this week?",
    [
      makeHit({
        id: "stress-note",
        sourceType: "diary",
        sourceId: "stress-note",
        chunkType: "reflection",
        text: "I felt stressed because the worker and quota problems could break the live AI memory search demo.",
        evidence: "felt stressed because the worker and quota problems could break the live AI memory search demo",
        similarity: 0.84,
        vectorSimilarity: 0.84,
        occurredAt: new Date("2026-07-13T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      answerStrategy: "deep",
      generateAnswer: async (options: any) => ({
        data: options.validator.parse({
          answer: "Dựa trên các ghi chép tuần này, mình",
          confidence: "medium",
          citations: [
            {
              marker: "S1",
              claim: "felt stressed because the worker and quota problems",
            },
          ],
        }),
        tokenUsage: {
          promptTokens: 20,
          completionTokens: 8,
          totalTokens: 28,
          model: "test-model",
        },
      }),
    },
  );

  assert.equal(result.answerMode, "extractive_fallback");
  assert.equal(result.modelError?.kind, "validation");
  assert.equal(result.citations.length, 1);
  assert.match(result.answer, /Bạn cảm thấy stress vì worker và quota/);
});

test("answerFromChunks rejects generated latency answers cut off after a partial p95 claim", async () => {
  const result = await answerFromChunks(
    "Why did we separate retrieval latency from answer generation?",
    [
      makeHit({
        id: "latency-note-1",
        sourceType: "diary",
        sourceId: "latency-note",
        chunkType: "decision",
        text: "We should measure retrieval latency separately from Gemini answer generation. The metrics are embedding time, database retrieval time, reranking time, time to first result, answer generation time, and total answer time.",
        evidence: "measure retrieval latency separately from Gemini answer generation",
        similarity: 0.8,
        vectorSimilarity: 0.8,
        occurredAt: new Date("2026-07-12T00:00:00.000Z"),
      }),
      makeHit({
        id: "latency-note-2",
        sourceType: "diary",
        sourceId: "latency-note",
        chunkType: "decision",
        text: "We should claim p95 retrieval latency, not average full answer latency.",
        evidence: "claim p95 retrieval latency",
        similarity: 0.79,
        vectorSimilarity: 0.79,
        occurredAt: new Date("2026-07-12T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "en",
      answerStrategy: "deep",
      generateAnswer: async (options: any) => ({
        data: options.validator.parse({
          answer: "We separated search latency from answer generation to claim p",
          confidence: "medium",
          citations: [
            {
              marker: "S1",
              claim: "measure retrieval latency separately from Gemini answer generation",
            },
          ],
        }),
        tokenUsage: {
          promptTokens: 700,
          completionTokens: 12,
          totalTokens: 712,
          model: "test-model",
        },
      }),
    },
  );

  assert.equal(result.answerMode, "extractive_fallback");
  assert.equal(result.modelError?.kind, "validation");
  assert.ok(result.citations.length >= 1);
  assert.doesNotMatch(result.answer, /to claim p$/i);
  assert.match(result.answer, /retrieval latency/);
  assert.match(result.answer, /answer generation/);
});

test("answerFromChunks feedback fallback ignores unrelated Google Contacts memories that only mention Linh", async () => {
  const result = await answerFromChunks(
    "What feedback did mentor Linh give about citations?",
    [
      makeHit({
        id: "contacts-plan",
        sourceType: "diary",
        sourceId: "contacts-plan",
        chunkType: "decision",
        text: "We wrote down a future plan for Google Contacts. It would help the memory engine resolve names like Linh, Quan, or Duc Anh.",
        evidence: "future plan for Google Contacts",
        similarity: 0.88,
        vectorSimilarity: 0.88,
        occurredAt: new Date("2026-07-16T00:00:00.000Z"),
      }),
      makeHit({
        id: "linh-feedback",
        sourceType: "diary",
        sourceId: "linh-feedback",
        chunkType: "feedback",
        text: "Mentor Linh said the citation UI must be obvious so evaluators can trust the AI answer.",
        evidence: "Mentor Linh said the citation UI must be obvious so evaluators can trust the AI answer.",
        similarity: 0.72,
        vectorSimilarity: 0.72,
        occurredAt: new Date("2026-07-13T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      generateAnswer: async () => {
        throw new Error("Gemini returned invalid JSON that could not be repaired: {");
      },
    },
  );

  assert.equal(result.answerMode, "fast_path");
  assert.equal(result.analytics?.answerMode, "fast_path");
  assert.equal(result.modelError, undefined);
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0]?.sourceId, "linh-feedback");
  assert.match(result.answer, /Phản hồi liên quan/);
  assert.match(result.answer, /citation rõ ràng/);
  assert.doesNotMatch(result.answer, /Google Contacts|People API/i);
});

test("answerFromChunks blocker fallback ignores demo question notes and keeps actual blockers", async () => {
  const result = await answerFromChunks(
    "What blockers did we have this week?",
    [
      makeHit({
        id: "demo-flow",
        sourceType: "diary",
        sourceId: "demo-flow",
        chunkType: "general",
        text: "Duc Anh rehearsed the frontend demo flow. The user starts on Diary, then asks Search about mentor feedback and blockers.",
        evidence: "asks Search about mentor feedback and blockers",
        similarity: 0.86,
        vectorSimilarity: 0.86,
        occurredAt: new Date("2026-07-15T00:00:00.000Z"),
      }),
      makeHit({
        id: "worker-blocker",
        sourceType: "diary",
        sourceId: "worker-blocker",
        chunkType: "action_item",
        text: "The main blocker this week is making sure the worker is running before the final rehearsal. Another risk is Gemini quota during the live demo.",
        evidence: "main blocker this week is making sure the worker is running before the final rehearsal. Another risk is Gemini quota during the live demo.",
        similarity: 0.7,
        vectorSimilarity: 0.7,
        occurredAt: new Date("2026-07-11T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      generateAnswer: async () => {
        throw new Error("Gemini returned invalid JSON that could not be repaired: {");
      },
    },
  );

  assert.equal(result.answerMode, "fast_path");
  assert.equal(result.analytics?.answerMode, "fast_path");
  assert.equal(result.modelError, undefined);
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0]?.sourceId, "worker-blocker");
  assert.match(result.answer, /worker chạy trước final rehearsal/);
  assert.match(result.answer, /Gemini quota/);
  assert.doesNotMatch(result.answer, /asks Search about/i);
});

test("answerFromChunks blocker fast path refuses checklist-only evidence", async () => {
  let generateCalled = false;
  const result = await answerFromChunks(
    "What blockers did we have this week?",
    [
      makeHit({
        id: "final-checklist",
        sourceType: "diary",
        sourceId: "final-checklist",
        chunkType: "general",
        text: "The final AI memory checklist has six items. First, seed realistic diary data. Second, run the worker to create memory chunks. Third, ask questions about feedback, decisions, blockers, mood, Calendar, and attachments. Fourth, verify citations.",
        evidence: "ask questions about feedback, decisions, blockers, mood, Calendar, and attachments",
        similarity: 0.86,
        vectorSimilarity: 0.86,
        occurredAt: new Date("2026-07-17T00:00:00.000Z"),
      }),
      makeHit({
        id: "demo-ready",
        sourceType: "diary",
        sourceId: "demo-ready",
        chunkType: "general",
        text: "Today the demo account is ready for AI memory testing. We confirmed that diary entries, mood tags, indexing jobs, and search citations are available.",
        evidence: "demo account is ready for AI memory testing",
        similarity: 0.8,
        vectorSimilarity: 0.8,
        occurredAt: new Date("2026-07-18T00:00:00.000Z"),
      }),
      makeHit({
        id: "gmail-scope",
        sourceType: "diary",
        sourceId: "gmail-scope",
        chunkType: "decision",
        text: "We made a scope decision today: Gmail and Google Contacts will stay as future work unless the core demo is already stable.",
        evidence: "Gmail and Google Contacts will stay as future work unless the core demo is already stable",
        similarity: 0.74,
        vectorSimilarity: 0.74,
        occurredAt: new Date("2026-07-14T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "en",
      generateAnswer: async () => {
        generateCalled = true;
        throw new Error("Gemini should not be called without real blocker evidence");
      },
    },
  );

  assert.equal(generateCalled, false);
  assert.equal(result.answerMode, "no_memory");
  assert.equal(result.analytics?.status, "no_memory");
  assert.equal(result.citations.length, 0);
  assert.match(result.answer, /could not find any clearly recorded blockers/i);
  assert.doesNotMatch(result.answer, /final AI memory checklist/i);
});

test("answerFromChunks auto tries Gemini for why-latency questions, then falls back to evidence", async () => {
  const result = await answerFromChunks(
    "Why did we separate retrieval latency from answer generation?",
    [
      makeHit({
        id: "question-list",
        sourceType: "diary",
        sourceId: "question-list",
        chunkType: "general",
        text: "The best questions are: what feedback did Linh give, what blockers did we have this week, why did we separate retrieval latency from answer generation.",
        evidence: "best questions are",
        similarity: 0.9,
        vectorSimilarity: 0.9,
        occurredAt: new Date("2026-07-18T00:00:00.000Z"),
      }),
      makeHit({
        id: "latency-note",
        sourceType: "diary",
        sourceId: "latency-note",
        chunkType: "decision",
        text: "We should measure retrieval latency separately from Gemini answer generation. The metrics are embedding time, database retrieval time, reranking time, time to first result, answer generation time, and total answer time.",
        evidence: "measure retrieval latency separately from Gemini answer generation",
        similarity: 0.74,
        vectorSimilarity: 0.74,
        occurredAt: new Date("2026-07-12T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      generateAnswer: async () => {
        throw new Error("Gemini returned invalid JSON that could not be repaired: {");
      },
    },
  );

  assert.equal(result.answerMode, "extractive_fallback");
  assert.equal(result.analytics?.answerMode, "extractive_fallback");
  assert.equal(result.modelError?.kind, "validation");
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0]?.sourceId, "latency-note");
  assert.match(result.answer, /retrieval latency/);
  assert.match(result.answer, /answer generation/);
  assert.doesNotMatch(result.answer, /best questions are/i);
});

test("answerFromChunks validation fallback answers Google Contacts questions from matching memories", async () => {
  const result = await answerFromChunks(
    "What was the future plan for Google Contacts?",
    [
      makeHit({
        id: "demo-ready",
        sourceType: "diary",
        sourceId: "demo-ready",
        chunkType: "general",
        text: "Today the demo account is ready for AI memory testing. We confirmed diary entries, mood tags, indexing jobs, and search citations are available.",
        evidence: "demo account is ready for AI memory testing",
        similarity: 0.84,
        vectorSimilarity: 0.84,
        occurredAt: new Date("2026-07-18T00:00:00.000Z"),
      }),
      makeHit({
        id: "contacts-plan",
        sourceType: "diary",
        sourceId: "contacts-plan",
        chunkType: "decision",
        text: "We wrote down a future plan for Google Contacts. The feature would sync contact names, emails, phone numbers, and organizations from Google People API.",
        evidence: "future plan for Google Contacts. The feature would sync contact names, emails, phone numbers, and organizations from Google People API",
        similarity: 0.75,
        vectorSimilarity: 0.75,
        occurredAt: new Date("2026-07-16T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      generateAnswer: async () => {
        throw new Error('Gemini returned invalid JSON that could not be repaired: {"answer":"');
      },
    },
  );

  assert.equal(result.answerMode, "fast_path");
  assert.equal(result.analytics?.answerMode, "fast_path");
  assert.equal(result.modelError, undefined);
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0]?.sourceId, "contacts-plan");
  assert.match(result.answer, /Google Contacts/);
  assert.match(result.answer, /People API/);
  assert.doesNotMatch(result.answer, /demo account is ready/i);
});

test("answerFromChunks validation fallback infers Google Contacts from the top source", async () => {
  const result = await answerFromChunks(
    "What was the future plan?",
    [
      makeHit({
        id: "contacts-plan",
        sourceType: "diary",
        sourceId: "contacts-plan",
        chunkType: "decision",
        text: "We wrote down a future plan for Google Contacts. The feature would sync contact names, emails, phone numbers, and organizations from Google People API.",
        evidence: "future plan for Google Contacts. The feature would sync contact names, emails, phone numbers, and organizations from Google People API",
        similarity: 0.82,
        vectorSimilarity: 0.82,
        occurredAt: new Date("2026-07-16T00:00:00.000Z"),
      }),
      makeHit({
        id: "frontend-flow",
        sourceType: "diary",
        sourceId: "frontend-flow",
        chunkType: "event",
        text: "Duc Anh rehearsed the frontend demo flow. The user starts on Diary, writes an entry with mood and tags, uploads an attachment, opens Settings to sync Calendar.",
        evidence: "Duc Anh rehearsed the frontend demo flow",
        similarity: 0.74,
        vectorSimilarity: 0.74,
        occurredAt: new Date("2026-07-15T00:00:00.000Z"),
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

  assert.equal(result.answerMode, "fast_path");
  assert.equal(result.analytics?.answerMode, "fast_path");
  assert.equal(result.modelError, undefined);
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0]?.sourceId, "contacts-plan");
  assert.match(result.answer, /Quyết định\/kế hoạch liên quan/);
  assert.match(result.answer, /People API/);
  assert.doesNotMatch(result.answer, /frontend demo flow/i);
});

test("answerFromChunks Gmail fast path excludes unrelated latency decisions", async () => {
  let generateCalled = false;
  const result = await answerFromChunks(
    "What did we decide about Gmail?",
    [
      makeHit({
        id: "latency-plan",
        sourceType: "diary",
        sourceId: "latency-plan",
        chunkType: "decision",
        text: "We should claim p95 retrieval latency, not average full answer latency.",
        evidence: "claim p95 retrieval latency",
        similarity: 0.88,
        vectorSimilarity: 0.88,
        occurredAt: new Date("2026-07-12T00:00:00.000Z"),
      }),
      makeHit({
        id: "gmail-scope",
        sourceType: "diary",
        sourceId: "gmail-scope",
        chunkType: "decision",
        text: "We made a scope decision today: Gmail and Google Contacts will stay as future work unless the core demo is already stable.",
        evidence: "Gmail and Google Contacts will stay as future work unless the core demo is already stable",
        similarity: 0.72,
        vectorSimilarity: 0.72,
        occurredAt: new Date("2026-07-14T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      generateAnswer: async () => {
        generateCalled = true;
        throw new Error("Gemini should not be called for supported Gmail evidence");
      },
    },
  );

  assert.equal(generateCalled, false);
  assert.equal(result.answerMode, "fast_path");
  assert.equal(result.analytics?.tokenUsage.totalTokens, 0);
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0]?.sourceId, "gmail-scope");
  assert.match(result.answer, /Gmail/);
  assert.match(result.answer, /future work/);
  assert.doesNotMatch(result.answer, /p95 retrieval latency/);
});

test("answerFromChunks stress questions refuse positive mood and test-question notes", async () => {
  let generateCalled = false;
  const result = await answerFromChunks(
    "What made me feel stressed this week?",
    [
      makeHit({
        id: "good-mood",
        sourceType: "diary",
        sourceId: "good-mood",
        chunkType: "reflection",
        text: "Felt great during the demo day readiness check.",
        evidence: "Felt great during the demo day readiness check",
        similarity: 0.86,
        vectorSimilarity: 0.86,
        occurredAt: new Date("2026-07-18T00:00:00.000Z"),
      }),
      makeHit({
        id: "question-note",
        sourceType: "diary",
        sourceId: "question-note",
        chunkType: "general",
        text: "This helps us test questions like what made me stressed this week.",
        evidence: "test questions like what made me stressed this week",
        similarity: 0.82,
        vectorSimilarity: 0.82,
        occurredAt: new Date("2026-07-10T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      generateAnswer: async () => {
        generateCalled = true;
        throw new Error("Gemini should not be called without stress evidence");
      },
    },
  );

  assert.equal(generateCalled, false);
  assert.equal(result.answerMode, "no_memory");
  assert.equal(result.analytics?.status, "no_memory");
  assert.equal(result.citations.length, 0);
  assert.match(result.answer, /chưa tìm thấy/i);
});

test("answerFromChunks stress fast path uses explicit stress evidence", async () => {
  let generateCalled = false;
  const result = await answerFromChunks(
    "What made me feel stressed this week?",
    [
      makeHit({
        id: "worker-stress",
        sourceType: "diary",
        sourceId: "worker-stress",
        chunkType: "reflection",
        text: "I felt stressed because the worker and quota problems could break the live AI memory search demo.",
        evidence: "felt stressed because the worker and quota problems could break the live AI memory search demo",
        similarity: 0.84,
        vectorSimilarity: 0.84,
        occurredAt: new Date("2026-07-13T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      generateAnswer: async () => {
        generateCalled = true;
        throw new Error("Gemini should not be called for supported stress evidence");
      },
    },
  );

  assert.equal(generateCalled, false);
  assert.equal(result.answerMode, "fast_path");
  assert.equal(result.citations.length, 1);
  assert.match(result.answer, /Bạn cảm thấy stress vì worker và quota/);
});

test("answerFromChunks fast path localizes evidence bullets in Vietnamese", async () => {
  let generateCalled = false;
  const result = await answerFromChunks(
    "What did we decide about Gmail?",
    [
      makeHit({
        id: "gmail-scope",
        sourceType: "diary",
        sourceId: "gmail-scope",
        chunkType: "decision",
        text: "We made a scope decision today: Gmail and Google Contacts will stay as future work unless the core demo is already stable.",
        evidence: "Gmail and Google Contacts will stay as future work unless the core demo is already stable",
        similarity: 0.78,
        vectorSimilarity: 0.78,
        occurredAt: new Date("2026-07-14T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      generateAnswer: async () => {
        generateCalled = true;
        throw new Error("Gemini should not be called for supported Gmail evidence");
      },
    },
  );

  assert.equal(generateCalled, false);
  assert.equal(result.answerMode, "fast_path");
  assert.match(result.answer, /Quyết định về Gmail/);
  assert.match(result.answer, /Nhóm quyết định để Gmail và Google Contacts ở future work/);
});

test("answerFromChunks fast path keeps English evidence bullets when requested", async () => {
  let generateCalled = false;
  const result = await answerFromChunks(
    "What did we decide about Gmail?",
    [
      makeHit({
        id: "gmail-scope",
        sourceType: "diary",
        sourceId: "gmail-scope",
        chunkType: "decision",
        text: "We made a scope decision today: Gmail and Google Contacts will stay as future work unless the core demo is already stable.",
        evidence: "Gmail and Google Contacts will stay as future work unless the core demo is already stable",
        similarity: 0.78,
        vectorSimilarity: 0.78,
        occurredAt: new Date("2026-07-14T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "en",
      generateAnswer: async () => {
        generateCalled = true;
        throw new Error("Gemini should not be called for supported Gmail evidence");
      },
    },
  );

  assert.equal(generateCalled, false);
  assert.equal(result.answerMode, "fast_path");
  assert.match(result.answer, /The Gmail decision was/);
  assert.match(result.answer, /Gmail and Google Contacts will stay as future work/);
  assert.doesNotMatch(result.answer, /Nhóm quyết định/);
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
      answerStrategy: "deep",
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

test("answerFromChunks rejects generated names that are not supported by evidence", async () => {
  const result = await answerFromChunks(
    "What feedback did Linh give about citation UI?",
    [
      makeHit({
        id: "linh-feedback",
        sourceType: "diary",
        chunkType: "feedback",
        text: "Mentor Linh said the citation UI must be obvious so evaluators can trust the AI.",
        evidence: "Mentor Linh said the citation UI must be obvious so evaluators can trust the AI.",
        similarity: 0.86,
        vectorSimilarity: 0.86,
        occurredAt: new Date("2026-05-13T00:00:00.000Z"),
      }),
    ],
    {
      answerStrategy: "deep",
      generateAnswer: async (options: any) => ({
        data: options.validator.parse({
          answer: "Alex said the citation UI must be obvious so evaluators can trust the AI.",
          confidence: "high",
          citations: [
            {
              marker: "S1",
              claim: "Mentor Linh said the citation UI must be obvious so evaluators can trust the AI.",
            },
          ],
        }),
        tokenUsage: {
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30,
          model: "test-model",
        },
      }),
    },
  );

  assert.equal(result.answerMode, "extractive_fallback");
  assert.equal(result.modelError?.kind, "validation");
  assert.doesNotMatch(result.answer, /Alex/);
  assert.match(result.answer, /Linh/);
});

test("answerFromChunks augments citations for supported Vietnamese generated names", async () => {
  const result = await answerFromChunks(
    "Gmail trong project nên làm gì?",
    [
      makeHit({
        id: "gmail-scope",
        sourceType: "diary",
        chunkType: "decision",
        text: "We decided to keep Gmail and Google Contacts as future work unless the core demo is stable.",
        evidence: "keep Gmail and Google Contacts as future work unless the core demo is stable",
        similarity: 0.87,
        vectorSimilarity: 0.87,
        occurredAt: new Date("2026-07-14T00:00:00.000Z"),
      }),
      makeHit({
        id: "linh-scope-feedback",
        sourceType: "diary",
        chunkType: "feedback",
        text: "Linh warned us not to add Gmail until Diary, Calendar, Attachment, and grounded search are stable.",
        evidence: "Linh warned us not to add Gmail until Diary, Calendar, Attachment, and grounded search are stable",
        similarity: 0.79,
        vectorSimilarity: 0.79,
        occurredAt: new Date("2026-07-14T00:00:00.000Z"),
      }),
    ],
    {
      answerStrategy: "deep",
      responseLanguage: "vi",
      generateAnswer: async (options: any) => ({
        data: options.validator.parse({
          answer:
            "Nhóm quyết định để Gmail và Google Contacts ở future work; theo góp ý của Linh, chưa nên thêm Gmail trước khi Diary, Calendar, Attachment và grounded search ổn định.",
          confidence: "high",
          citations: [
            {
              marker: "S1",
              claim: "keep Gmail and Google Contacts as future work unless the core demo is stable",
            },
          ],
        }),
        tokenUsage: {
          promptTokens: 60,
          completionTokens: 35,
          totalTokens: 95,
          model: "test-model",
        },
      }),
    },
  );

  assert.equal(result.answerMode, "gemini");
  assert.equal(result.modelError, undefined);
  assert.ok(result.citations.some((citation) => citation.chunkId === "gmail-scope"));
  assert.ok(result.citations.some((citation) => citation.chunkId === "linh-scope-feedback"));
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
      answerStrategy: "deep",
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
  assert.match(result.answer, /ký ức liên quan nhất/);
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
  assert.match(result.answer, /Mình tìm thấy ký ức khớp nhất/);
  assert.match(result.answer, /felt focused/);
});

test("answerFromChunks fast strategy filters noisy sample-question memories", async () => {
  let generateCalled = false;
  const result = await answerFromChunks(
    "What did I work on for search quality?",
    [
      makeHit({
        id: "sample-question",
        sourceType: "diary",
        sourceId: "sample-question",
        chunkType: "general",
        text: "The best questions are: what feedback did Linh give, what blockers did we have this week, and why did we separate retrieval latency.",
        evidence: "best questions are",
        similarity: 0.88,
        vectorSimilarity: 0.88,
        occurredAt: new Date("2026-07-18T00:00:00.000Z"),
      }),
      makeHit({
        id: "real-search-work",
        sourceType: "diary",
        sourceId: "real-search-work",
        chunkType: "general",
        text: "I improved search source cards, citation highlighting, and AI debug visibility for the MVP demo.",
        evidence: "improved search source cards, citation highlighting, and AI debug visibility",
        similarity: 0.8,
        vectorSimilarity: 0.8,
        occurredAt: new Date("2026-07-17T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "en",
      answerStrategy: "fast",
      generateAnswer: async () => {
        generateCalled = true;
        throw new Error("should not generate in fast strategy");
      },
    },
  );

  assert.equal(generateCalled, false);
  assert.equal(result.answerMode, "fast_path");
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0]?.chunkId, "real-search-work");
  assert.match(result.answer, /The strongest progress memory is from/);
  assert.match(result.answer, /improved search source cards/);
  assert.doesNotMatch(result.answer, /best questions are/i);
});

test("answerFromChunks auto uses Gemini for reasoning-heavy latency questions", async () => {
  let generateCalled = false;
  const result = await answerFromChunks(
    "Why did we separate retrieval latency from answer generation?",
    [
      makeHit({
        id: "latency-reasoning",
        sourceType: "diary",
        sourceId: "latency-diary",
        chunkType: "decision",
        text: "The team separated retrieval latency from answer generation to measure embedding time, database retrieval, reranking, time to first result, answer generation time, and total answer time.",
        evidence: "separated retrieval latency from answer generation to measure embedding time, database retrieval, reranking, time to first result, answer generation time, and total answer time",
        similarity: 0.9,
        vectorSimilarity: 0.9,
        occurredAt: new Date("2026-07-12T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "en",
      generateAnswer: async (options: any) => {
        generateCalled = true;
        return {
          data: options.validator.parse({
            answer: "The team separated retrieval latency from answer generation so they could measure embedding time, database retrieval, reranking, time to first result, answer generation time, and total answer time separately.",
            confidence: "high",
            citations: [
              {
                marker: "S1",
                claim: "separated retrieval latency from answer generation to measure embedding time, database retrieval, reranking, time to first result, answer generation time, and total answer time",
              },
            ],
          }),
          tokenUsage: {
            promptTokens: 64,
            completionTokens: 36,
            totalTokens: 100,
            model: "test-gemini",
          },
        };
      },
    },
  );

  assert.equal(generateCalled, true);
  assert.equal(result.answerMode, "gemini");
  assert.equal(result.analytics?.answerMode, "gemini");
  assert.equal(result.analytics?.tokenUsage.totalTokens, 100);
  assert.match(result.answer, /measure embedding time/);
});

test("answerFromChunks auto uses fast path for direct fact lookup questions", async () => {
  let generateCalled = false;
  const result = await answerFromChunks(
    "When was the Backend API Check scheduled?",
    [
      makeHit({
        id: "api-check-event",
        sourceType: "calendar",
        sourceId: "eval-calendar-api-check",
        chunkType: "event",
        text: "Calendar event: Backend API Check scheduled on May 12, 2026 at 08:00 UTC. Quan reviews diary CRUD and summary API contract.",
        evidence: "Backend API Check scheduled on May 12, 2026 at 08:00 UTC",
        similarity: 0.88,
        vectorSimilarity: 0.88,
        occurredAt: new Date("2026-05-12T08:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "en",
      generateAnswer: async () => {
        generateCalled = true;
        throw new Error("Auto fact lookup should not call generation");
      },
    },
  );

  assert.equal(generateCalled, false);
  assert.equal(result.answerMode, "fast_path");
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0]?.sourceId, "eval-calendar-api-check");
  assert.match(result.answer, /backend API Check/i);
});

test("answerFromChunks auto uses Gemini for summarize questions", async () => {
  let generateCalled = false;
  const result = await answerFromChunks(
    "Summarize my latest diary memories.",
    [
      makeHit({
        id: "latest-search-work",
        sourceType: "diary",
        sourceId: "latest-diary",
        chunkType: "general",
        text: "Latest diary memory: I improved search source cards, citation highlighting, and AI debug visibility for the MVP demo.",
        evidence: "improved search source cards, citation highlighting, and AI debug visibility",
        similarity: 0.86,
        vectorSimilarity: 0.86,
        occurredAt: new Date("2026-07-18T00:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "en",
      generateAnswer: async (options: any) => {
        generateCalled = true;
        return {
          data: options.validator.parse({
            answer: "the latest diary memory focused on improving search source cards, citation highlighting, and AI debug visibility.",
            confidence: "high",
            citations: [
              {
                marker: "S1",
                claim: "improved search source cards, citation highlighting, and AI debug visibility",
              },
            ],
          }),
          tokenUsage: {
            promptTokens: 48,
            completionTokens: 30,
            totalTokens: 78,
            model: "test-gemini",
          },
        };
      },
    },
  );

  assert.equal(generateCalled, true);
  assert.equal(result.answerMode, "gemini");
  assert.equal(result.citations.length, 1);
  assert.match(result.answer, /source cards/);
});

test("answerFromChunks broad recent work fallback keeps diverse diary days", async () => {
  const chunks = Array.from({ length: 8 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return makeHit({
      id: `july-work-${day}`,
      sourceType: "diary",
      sourceId: `july-diary-${day}`,
      chunkType: "general",
      text: `On July ${index + 1}, I worked on MVP task ${index + 1}: diary flow, indexing, citations, Google integration, and demo readiness.`,
      evidence: `worked on MVP task ${index + 1}`,
      similarity: 0.88 - index * 0.01,
      vectorSimilarity: 0.86,
      occurredAt: new Date(`2026-07-${day}T09:00:00.000Z`),
    });
  });

  const result = await answerFromChunks(
    "What did I work on recently?",
    chunks,
    {
      responseLanguage: "en",
      generateAnswer: async (options: any) => ({
        data: options.validator.parse({
          answer: "In August, Martin worked with Zoe on Terraform billing migration.",
          confidence: "medium",
          citations: [],
        }),
        tokenUsage: {
          promptTokens: 120,
          completionTokens: 18,
          totalTokens: 138,
          model: "test-gemini",
        },
      }),
    },
  );

  assert.equal(result.answerMode, "extractive_fallback");
  assert.equal(result.citations.length, 6);
  assert.match(result.answer, /July 1, 2026/);
  assert.match(result.answer, /July 6, 2026/);
});

test("answerFromChunks Vietnamese monthly fallback prefers diary evidence over raw summaries", async () => {
  const chunks = [
    makeHit({
      id: "monthly-summary",
      sourceType: "summary",
      sourceId: "summary-july",
      chunkType: "reflection",
      text: "Monthly Retrospective: July 2026 This retrospective covers the period from July 1st to July 31st, 2026. The insights are primarily derived from weekly summaries.",
      evidence: "Monthly Retrospective: July 2026 This retrospective covers the period from July 1st to July 31st, 2026. The insights are primarily derived from weekly summaries.",
      similarity: 0.96,
      vectorSimilarity: 0.96,
      occurredAt: new Date("2026-07-01T02:00:00.000Z"),
    }),
    makeHit({
      id: "weekly-summary",
      sourceType: "summary",
      sourceId: "summary-week",
      chunkType: "reflection",
      text: 'Weekly Review: 2026-07-06 to 2026-07-12 Key Events: On July 9th, the diarist reported doing nothing and sleeping "from morning to night."',
      evidence: 'Weekly Review: 2026-07-06 to 2026-07-12 Key Events: On July 9th, the diarist reported doing nothing and sleeping "from morning to night."',
      similarity: 0.94,
      vectorSimilarity: 0.94,
      occurredAt: new Date("2026-07-06T02:00:00.000Z"),
    }),
    makeHit({
      id: "july-capstone-paper",
      sourceType: "diary",
      sourceId: "diary-2026-07-01",
      chunkType: "general",
      text: "I stayed home today to edit my capstone paper.",
      evidence: "I stayed home today to edit my capstone paper.",
      similarity: 0.91,
      vectorSimilarity: 0.91,
      occurredAt: new Date("2026-07-01T02:00:00.000Z"),
    }),
    makeHit({
      id: "july-sleep",
      sourceType: "diary",
      sourceId: "diary-2026-07-09",
      chunkType: "general",
      text: "Hôm nay tôi không làm gì, chỉ nằm ngủ từ sáng tới tối.",
      evidence: "Hôm nay tôi không làm gì, chỉ nằm ngủ từ sáng tới tối.",
      similarity: 0.89,
      vectorSimilarity: 0.89,
      occurredAt: new Date("2026-07-09T02:00:00.000Z"),
    }),
    makeHit({
      id: "july-cafe-project",
      sourceType: "diary",
      sourceId: "diary-2026-07-14",
      chunkType: "general",
      text: "Tôi chỉ đi ra ngoài ngồi Café và cố gắng hoàn thành project.",
      evidence: "Tôi chỉ đi ra ngoài ngồi Café và cố gắng hoàn thành project.",
      similarity: 0.88,
      vectorSimilarity: 0.88,
      occurredAt: new Date("2026-07-14T02:00:00.000Z"),
    }),
  ];

  const result = await answerFromChunks(
    "tóm tắt tháng 7 tôi làm gì?",
    chunks,
    {
      responseLanguage: "vi",
      generateAnswer: async (options: any) => ({
        data: options.validator.parse({
          answer: "Trong tháng 8, Martin làm deployment với Zoe.",
          confidence: "medium",
          citations: [],
        }),
        tokenUsage: {
          promptTokens: 160,
          completionTokens: 28,
          totalTokens: 188,
          model: "test-gemini",
        },
      }),
    },
  );

  assert.equal(result.answerMode, "extractive_fallback");
  assert.equal(result.citations.length, 3);
  assert.ok(result.citations.every((citation) => citation.sourceType === "diary"));
  assert.match(result.answer, /chỉnh sửa bài capstone/);
  assert.match(result.answer, /ngủ từ sáng tới tối/);
  assert.match(result.answer, /quán cà phê/);
  assert.doesNotMatch(result.answer, /I stayed home today/i);
  assert.doesNotMatch(result.answer, /Weekly Review|Monthly Retrospective/);
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
  assert.match(result.answer, /you went to a cafe to study that day/);
});

test("answerSingleDayFastPath strips diary titles from titled entries", () => {
  const result = answerSingleDayFastPath(
    "what did i do on 26/7",
    [
      makeHit({
        id: "demo-mvp-checklist",
        sourceType: "diary",
        sourceId: "demo-mvp-diary-06",
        chunkType: "general",
        text: "[DEMO MVP] Final MVP checklist\n\nThe MVP is ready when diary entries, memory chunks, summaries, Calendar events, linked events, and outbox health all pass the demo readiness checks. We should rehearse the flow from diary creation to search answer with citations.",
        evidence: "[DEMO MVP] Final MVP checklist\n\nThe MVP is ready when diary entries, memory chunks, summaries, Calendar events, linked events, and outbox health all pass the demo readiness checks. We should rehearse the flow from diary creation to search answer with citations.",
        metadata: { sourceTitle: "[DEMO MVP] Final MVP checklist" },
        similarity: 0.72,
        vectorSimilarity: 0,
        lexicalScore: 1,
        retrievalMode: "temporal",
        occurredAt: new Date("2026-07-26T05:00:00.000Z"),
      }),
    ],
    {
      startDate: new Date("2026-07-26T00:00:00.000Z"),
      endDate: new Date("2026-07-26T23:59:59.999Z"),
    },
    "en",
    0.62,
  );

  assert.ok(result);
  assert.equal(result.answerMode, "fast_path");
  assert.match(result.answer, /On July 26, 2026/);
  assert.match(result.answer, /you worked on the final MVP checklist/);
  assert.match(result.answer, /checking that diary entries, memory chunks, summaries, Calendar events, linked events, and outbox health/);
  assert.match(result.answer, /you planned to rehearse the flow from diary creation to search answer with citations/);
  assert.doesNotMatch(result.answer, /\[DEMO MVP\] Final MVP checklist/);
  assert.doesNotMatch(result.answer, /a…/);
  assert.doesNotMatch(result.citations[0]?.claim ?? "", /\[DEMO MVP\] Final MVP checklist/);
});

test("answerSingleDayFastPath prefers raw diary facts over generated daily summaries", () => {
  const result = answerSingleDayFastPath(
    "9/7 làm gì?",
    [
      makeHit({
        id: "daily-summary",
        sourceType: "summary",
        sourceId: "summary-2026-07-09",
        chunkType: "reflection",
        text: 'Daily Log: 2026-07-09 * **Events:** The entire day was spent sleeping. * **Weather:** It rained consistently throughout the day, described as "not good."',
        evidence: 'Daily Log: 2026-07-09 * **Events:** The entire day was spent sleeping. * **Weather:** It rained consistently throughout the day, described as "not good."',
        similarity: 0.91,
        vectorSimilarity: 0.91,
        occurredAt: new Date("2026-07-09T02:00:00.000Z"),
      }),
      makeHit({
        id: "diary-rest",
        sourceType: "diary",
        sourceId: "diary-2026-07-09",
        chunkType: "general",
        text: "Hôm nay tôi không làm gì, chỉ nằm ngủ từ sáng tới tối.",
        evidence: "Hôm nay tôi không làm gì, chỉ nằm ngủ từ sáng tới tối.",
        similarity: 0.87,
        vectorSimilarity: 0.87,
        occurredAt: new Date("2026-07-09T02:00:00.000Z"),
      }),
      makeHit({
        id: "diary-weather",
        sourceType: "diary",
        sourceId: "diary-2026-07-09",
        chunkType: "general",
        text: "Thời tiết hôm nay không đẹp, trời mưa nguyên ngày.",
        evidence: "Thời tiết hôm nay không đẹp, trời mưa nguyên ngày.",
        similarity: 0.82,
        vectorSimilarity: 0.82,
        occurredAt: new Date("2026-07-09T02:00:00.000Z"),
      }),
    ],
    {
      startDate: new Date("2026-07-09T00:00:00.000Z"),
      endDate: new Date("2026-07-09T23:59:59.999Z"),
    },
    "vi",
    0.62,
    "Asia/Ho_Chi_Minh",
  );

  assert.ok(result);
  assert.equal(result.answerMode, "fast_path");
  assert.equal(result.citations.length, 2);
  assert.ok(result.citations.every((citation) => citation.sourceType === "diary"));
  assert.match(result.answer, /09\/07\/2026/);
  assert.match(result.answer, /bạn không làm gì/);
  assert.match(result.answer, /nằm ngủ từ sáng tới tối/);
  assert.match(result.answer, /Thời tiết hôm đó không đẹp/);
  assert.match(result.answer, /trời mưa nguyên ngày/);
  assert.doesNotMatch(result.answer, /found these memories|ký ức nổi bật|Daily Log|Events/i);
  assert.doesNotMatch(result.answer, /\*\*/);
});

test("translateFastAnswerIfUseful uses a small Gemini call for cross-language fast answers", async () => {
  const baseResult = makeFastAnswerResult({
    answer:
      "Mình trả lời nhanh từ các ký ức liên quan nhất:\n- 12/07/2026: I felt focused while polishing capstone search sources and memory answers.",
    quote: "I felt focused while polishing capstone search sources and memory answers.",
  });
  let generateCalled = false;

  assert.equal(shouldTranslateFastAnswer(baseResult, "vi"), true);

  const result = await translateFastAnswerIfUseful(baseResult, {
    question: "Tôi đã tập trung vào gì?",
    responseLanguage: "vi",
    generateTranslation: async (options) => {
      generateCalled = true;
      assert.match(options.prompt, /Existing fast answer/);
      assert.equal(options.maxOutputTokens, 180);
      assert.equal(options.maxRetries, 0);
      assert.equal(options.maxFormatRetries, 0);
      return {
        data: {
          answer:
            "Mình trả lời nhanh từ ký ức liên quan nhất: ngày 12/07/2026, bạn tập trung polish search sources và memory answers cho capstone.",
        },
        tokenUsage: {
          promptTokens: 48,
          completionTokens: 26,
          totalTokens: 74,
          model: "test-gemini",
        },
      };
    },
  });

  assert.equal(generateCalled, true);
  assert.equal(result.answerMode, "fast_path");
  assert.match(result.answer, /bạn tập trung polish search sources/);
  assert.equal(result.citations, baseResult.citations);
  assert.equal(result.analytics?.tokenUsage.totalTokens, 74);
  assert.equal(result.analytics?.tokenUsage.model, "test-gemini");
  assert.ok((result.analytics?.timing.generateMs ?? 0) >= 0);
});

test("translateFastAnswerIfUseful skips Gemini when fast answer already matches target language", async () => {
  const baseResult = makeFastAnswerResult({
    answer:
      "Ngày 09/07/2026, bạn không làm gì, chỉ nằm ngủ từ sáng tới tối. Thời tiết hôm đó không đẹp, trời mưa nguyên ngày.",
    quote:
      "Hôm nay tôi không làm gì, chỉ nằm ngủ từ sáng tới tối. Thời tiết hôm nay không đẹp, trời mưa nguyên ngày.",
  });
  let generateCalled = false;

  assert.equal(shouldTranslateFastAnswer(baseResult, "vi"), false);

  const result = await translateFastAnswerIfUseful(baseResult, {
    question: "9/7 làm gì?",
    responseLanguage: "vi",
    generateTranslation: async () => {
      generateCalled = true;
      throw new Error("should not translate Vietnamese fast answers");
    },
  });

  assert.equal(generateCalled, false);
  assert.equal(result.answer, baseResult.answer);
  assert.equal(result.analytics?.tokenUsage.totalTokens, 0);
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

test("answerTemporalRangeFastPath answers direct blocker questions without generation", () => {
  const result = answerTemporalRangeFastPath(
    "What blockers did we have this week?",
    [
      makeHit({
        text: "The main blocker is making sure the worker is running before rehearsal.",
        chunkType: "action_item",
        similarity: 0.8,
        vectorSimilarity: 0.8,
      }),
    ],
    {
      startDate: new Date("2026-07-13T00:00:00.000Z"),
      endDate: new Date("2026-07-19T23:59:59.999Z"),
    },
    "en",
    0.62,
  );

  assert.ok(result);
  assert.equal(result.answerMode, "fast_path");
  assert.equal(result.analytics?.tokenUsage.model, "temporal-fast-path");
  assert.match(result.answer, /worker is running/);
});

test("answerTemporalRangeFastPath skips analyze blocker questions so Auto can use Deep", () => {
  const result = answerTemporalRangeFastPath(
    "Analyze why the blockers happened this week.",
    [
      makeHit({
        text: "The main blocker is making sure the worker is running before rehearsal.",
        chunkType: "action_item",
        similarity: 0.8,
        vectorSimilarity: 0.8,
      }),
    ],
    {
      startDate: new Date("2026-07-13T00:00:00.000Z"),
      endDate: new Date("2026-07-19T23:59:59.999Z"),
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
  assert.equal(result.debugTrace?.routingTrace?.selectedPath, "unindexed_fast_path");
  assert.equal(result.debugTrace?.routingTrace?.usedUnindexedDiary, true);
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

test("inferRetrievalFilters uses request timezone for hôm nay boundaries", () => {
  const now = new Date("2026-07-25T18:30:00.000Z");
  const filters = inferRetrievalFilters(
    "Hôm nay tôi đã làm gì?",
    now,
    "Asia/Ho_Chi_Minh",
  );

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.toISOString(), "2026-07-25T17:00:00.000Z");
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.toISOString(), "2026-07-26T16:59:59.999Z");
});

test("inferRetrievalFilters uses request timezone for tuần này boundaries", () => {
  const now = new Date("2026-07-25T18:30:00.000Z");
  const filters = inferRetrievalFilters(
    "Tuần này tôi làm gì?",
    now,
    "Asia/Ho_Chi_Minh",
  );

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.toISOString(), "2026-07-19T17:00:00.000Z");
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.toISOString(), "2026-07-26T16:59:59.999Z");
});

test("answerSingleDayFastPath formats local date labels with timezone", () => {
  const now = new Date("2026-07-25T18:30:00.000Z");
  const filters = inferRetrievalFilters(
    "Hôm nay tôi đã làm gì?",
    now,
    "Asia/Ho_Chi_Minh",
  );
  const result = answerSingleDayFastPath(
    "Hôm nay tôi đã làm gì?",
    [
      makeHit({
        text: "Tôi sửa temporal timezone cho AI memory.",
        similarity: 0.84,
        vectorSimilarity: 0.84,
        occurredAt: new Date("2026-07-26T02:00:00.000Z"),
      }),
    ],
    filters,
    "vi",
    0.62,
    "Asia/Ho_Chi_Minh",
  );

  assert.ok(result);
  assert.match(result.answer, /26\/07\/2026/);
  assert.doesNotMatch(result.answer, /25\/07\/2026/);
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

test("inferRetrievalFilters parses Vietnamese spelled day/month dates", () => {
  const filters = inferRetrievalFilters(
    "Ngày chín tháng bảy tôi làm gì?",
    new Date("2026-07-26T12:00:00.000Z"),
    "Asia/Ho_Chi_Minh",
  );

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.toISOString(), "2026-07-08T17:00:00.000Z");
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.toISOString(), "2026-07-09T16:59:59.999Z");
});

test("inferRetrievalFilters parses Vietnamese compound spelled dates", () => {
  const filters = inferRetrievalFilters(
    "Ngày hai mươi mốt tháng bảy tôi đã làm gì?",
    new Date("2026-07-26T12:00:00.000Z"),
  );

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.toISOString(), "2026-07-21T00:00:00.000Z");
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.toISOString(), "2026-07-21T23:59:59.999Z");
});

test("inferRetrievalFilters parses Vietnamese spelled month ranges", () => {
  const filters = inferRetrievalFilters(
    "Tháng bảy tôi làm gì?",
    new Date("2026-07-26T12:00:00.000Z"),
  );

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.toISOString(), "2026-07-31T23:59:59.999Z");
});

test("inferRetrievalFilters parses English ordinal day before month", () => {
  const filters = inferRetrievalFilters(
    "What did I do on the ninth of July?",
    new Date("2026-07-26T12:00:00.000Z"),
    "Asia/Ho_Chi_Minh",
  );

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.toISOString(), "2026-07-08T17:00:00.000Z");
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.toISOString(), "2026-07-09T16:59:59.999Z");
});

test("inferRetrievalFilters parses English ordinal day after month", () => {
  const filters = inferRetrievalFilters(
    "What did I do on July ninth?",
    new Date("2026-07-26T12:00:00.000Z"),
  );

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.toISOString(), "2026-07-09T00:00:00.000Z");
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.toISOString(), "2026-07-09T23:59:59.999Z");
});

test("inferRetrievalFilters parses English compound spelled dates", () => {
  const filters = inferRetrievalFilters(
    "What happened on the twenty first of July?",
    new Date("2026-07-26T12:00:00.000Z"),
  );

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.toISOString(), "2026-07-21T00:00:00.000Z");
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.toISOString(), "2026-07-21T23:59:59.999Z");
});

test("inferRetrievalFilters parses English month before compound day", () => {
  const filters = inferRetrievalFilters(
    "What happened on July twenty first 2026?",
    new Date("2026-07-26T12:00:00.000Z"),
  );

  assert.ok(filters.startDate instanceof Date);
  assert.equal(filters.startDate.toISOString(), "2026-07-21T00:00:00.000Z");
  assert.ok(filters.endDate instanceof Date);
  assert.equal(filters.endDate.toISOString(), "2026-07-21T23:59:59.999Z");
});

test("inferRetrievalFilters parses English ordinal month day", () => {
  const filters = inferRetrievalFilters(
    "What happened on May eighteenth?",
    new Date("2026-07-26T12:00:00.000Z"),
  );

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

function makeFastAnswerResult(overrides: {
  answer: string;
  quote: string;
}): AnswerMemoryResult {
  return {
    answer: overrides.answer,
    confidence: "medium",
    citations: [
      {
        marker: "S1",
        chunkId: "chunk-fast",
        sourceType: "diary",
        sourceId: "diary-fast",
        occurredAt: "2026-07-12T00:00:00.000Z",
        chunkType: "general",
        quote: overrides.quote,
        similarity: 0.84,
        vectorSimilarity: 0.84,
        lexicalScore: 0,
        retrievalMode: "hybrid",
      },
    ],
    answerMode: "fast_path",
    analytics: {
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: "fast-extractive",
      },
      timing: {
        embedMs: 0,
        retrieveMs: 0,
        generateMs: 0,
        totalMs: 0,
      },
      chunksRetrieved: 1,
      status: "success",
      answerMode: "fast_path",
    },
  };
}

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
