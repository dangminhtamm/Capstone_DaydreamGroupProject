import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import { generateGeminiJsonWithMeta, type GeminiTokenUsage } from "./gemini-json.ts";
import {
  retrieveMemoryWithEmbedding,
  type MemorySearchHit,
  type RetrievalFilters,
} from "./retrieval.ts";
import { createDefaultEmbeddingProvider } from "./embedding.ts";
import type { MemoryDbClient } from "./types.ts";

const MIN_TOP_SIMILARITY = Number(
  process.env.MEMORY_MIN_TOP_SIMILARITY ?? 0.62,
);
const DEFAULT_MAX_DISTANCE = Number(process.env.MEMORY_MAX_DISTANCE ?? 0.42);

const GroundedAnswerSchema = z.object({
  answer: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  citations: z.array(
    z.object({
      marker: z.string().regex(/^S\d+$/),
      claim: z
        .string()
        .min(1)
        .describe("The specific claim supported by this source"),
    }),
  ),
});

const GeminiGroundedAnswerResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    answer: { type: SchemaType.STRING },
    confidence: {
      type: SchemaType.STRING,
      description: "One of high, medium, low.",
    },
    citations: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          marker: {
            type: SchemaType.STRING,
            description: "Citation marker matching S1, S2, S3, etc.",
          },
          claim: {
            type: SchemaType.STRING,
            description: "The specific claim supported by this source.",
          },
        },
        required: ["marker", "claim"],
      },
    },
  },
  required: ["answer", "confidence", "citations"],
};

import {
  type MemoryCitation,
  buildCitations,
  classifyRetrievalConfidence,
} from "./answer-utils.ts";

// ── Analytics types ──────────────────────────────────────────────────

export interface QueryAnalytics {
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model: string;
  };
  timing: {
    embedMs: number;
    retrieveMs: number;
    generateMs: number;
    totalMs: number;
  };
  chunksRetrieved: number;
  status: "success" | "no_memory" | "error";
}

export interface MemoryDebugTrace {
  question: string;
  inferredFilters: Record<string, unknown>;
  appliedFilters: Record<string, unknown>;
  status: "success" | "no_memory" | "error";
  reason: string;
  chunksRetrieved: number;
  topChunks: Array<{
    id: string;
    sourceType: string;
    sourceId: string;
    sourceTitle?: string;
    chunkType: string;
    occurredAt: string;
    retrievalMode: string;
    similarity: number;
    vectorSimilarity: number;
    lexicalScore: number;
    distance: number | null;
    quote: string;
  }>;
}

// ── Result types ─────────────────────────────────────────────────────

export interface AnswerMemoryResult {
  answer: string;
  confidence: "high" | "medium" | "low";
  citations: MemoryCitation[];
  noMemory?: boolean;
  suggestions?: string[];
  analytics?: QueryAnalytics;
  tokenUsage?: { inputTokens: number; outputTokens: number; model: string };
  debugTrace?: MemoryDebugTrace;
  modelError?: {
    status?: number;
    kind: "quota" | "service_unavailable" | "validation" | "transient" | "unknown";
    message: string;
  };
}

export type ResponseLanguage = 'en' | 'vi';

export interface AnswerMemoryOptions {
  filters?: RetrievalFilters;
  limit?: number;
  maxDistance?: number;
  minTopSimilarity?: number;
  responseLanguage?: ResponseLanguage;
}

export async function answerMemory(
  question: string,
  userId: string,
  dbClient: MemoryDbClient,
  options: AnswerMemoryOptions = {},
): Promise<AnswerMemoryResult> {
  const totalStart = performance.now();
  const normalizedQuestion = question.trim();
  const lang = options.responseLanguage ?? 'en';

  if (!normalizedQuestion) {
    return noMemoryResult(lang === 'vi' ? 'Bạn chưa nhập câu hỏi.' : 'Please enter a question.', lang);
  }

  const inferredFilters = inferRetrievalFilters(normalizedQuestion);
  const appliedFilters = {
    ...inferredFilters,
    ...options.filters,
    limit: options.limit ?? 8,
    maxDistance: options.maxDistance ?? DEFAULT_MAX_DISTANCE,
  };

  // ── Embed + Retrieve ─────────────────────────────────────────────────────
  const embedStart = performance.now();
  const embedding = await createDefaultEmbeddingProvider().embedQuery(normalizedQuestion);
  const embedMs = performance.now() - embedStart;

  const retrieveStart = performance.now();
  const chunks = await retrieveMemoryWithEmbedding(
    normalizedQuestion,
    userId,
    dbClient,
    embedding,
    appliedFilters,
  );
  const retrieveMs = performance.now() - retrieveStart;

  const fastPathResult = answerSingleDayFastPath(
    normalizedQuestion,
    chunks,
    appliedFilters,
    lang,
    options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
  );
  const result = fastPathResult ?? await answerFromChunks(normalizedQuestion, chunks, {
    minTopSimilarity: options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
    responseLanguage: lang,
  });

  // Patch analytics timing: answerFromChunks already set generateMs,
  // but we need to fill in embed/retrieve timings and total.
  if (result.analytics) {
    result.analytics.timing.embedMs = Math.round(embedMs);
    result.analytics.timing.retrieveMs = Math.round(retrieveMs);
    result.analytics.timing.totalMs = Math.round(performance.now() - totalStart);
  }

  result.debugTrace = buildDebugTrace({
    question: normalizedQuestion,
    inferredFilters,
    appliedFilters,
    chunks,
    result,
  });

  return result;
}

export function answerSingleDayFastPath(
  question: string,
  chunks: MemorySearchHit[],
  filters: RetrievalFilters,
  lang: ResponseLanguage,
  minTopSimilarity: number,
): AnswerMemoryResult | null {
  if (!isSingleDayRange(filters) || !chunks.length || requiresGenerativeReasoning(question)) {
    return null;
  }

  const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);
  const topSimilarity = sortedChunks[0]?.similarity ?? 0;
  if (topSimilarity < minTopSimilarity || !hasAdequateSemanticSupport(sortedChunks)) {
    return null;
  }

  const citations = buildCitations(sortedChunks)
    .slice(0, 6)
    .map((citation) => ({
      ...citation,
      claim: citation.quote,
    }));

  if (!citations.length) return null;

  const dateLabel = formatDateForAnswer(filters.startDate!, lang);
  const answer = formatSingleDayAnswer(citations, dateLabel, lang);
  const confidence = classifyRetrievalConfidence(topSimilarity, citations.length);

  return {
    answer,
    confidence,
    citations,
    analytics: {
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: 'fast-path',
      },
      timing: {
        embedMs: 0,
        retrieveMs: 0,
        generateMs: 0,
        totalMs: 0,
      },
      chunksRetrieved: chunks.length,
      status: 'success',
    },
  };
}

function isSingleDayRange(filters: RetrievalFilters): boolean {
  if (!filters.startDate || !filters.endDate) return false;
  const start = filters.startDate.getTime();
  const end = filters.endDate.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false;

  const maxOneDayRangeMs = 24 * 60 * 60 * 1000;
  return end - start <= maxOneDayRangeMs;
}

function requiresGenerativeReasoning(question: string): boolean {
  const normalized = normalizeForIntent(question);
  return includesAny(normalized, [
    "why",
    "how",
    "compare",
    "comparison",
    "difference",
    "similar",
    "pattern",
    "trend",
    "analyze",
    "analysis",
    "insight",
    "feel",
    "felt",
    "emotion",
    "vì sao",
    "vi sao",
    "tại sao",
    "tai sao",
    "như thế nào",
    "nhu the nao",
    "so sánh",
    "so sanh",
    "khác gì",
    "khac gi",
    "phân tích",
    "phan tich",
    "cảm thấy",
    "cam thay",
    "cảm xúc",
    "cam xuc",
  ]);
}

function formatSingleDayAnswer(
  citations: MemoryCitation[],
  dateLabel: string,
  lang: ResponseLanguage,
): string {
  const lines = citations.map((citation) => `- ${sentenceCase(trimTrailingPunctuation(citation.quote))}.`);

  if (lang === 'vi') {
    return [
      `Vào ${dateLabel}, mình tìm thấy các ký ức sau:`,
      ...lines,
    ].join('\n');
  }

  return [
    `On ${dateLabel}, I found these memories:`,
    ...lines,
  ].join('\n');
}

function formatDateForAnswer(date: Date, lang: ResponseLanguage): string {
  if (lang === 'vi') {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function trimTrailingPunctuation(value: string): string {
  return value.trim().replace(/[.!?。！？]+$/u, '');
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

export async function answerFromChunks(
  question: string,
  chunks: MemorySearchHit[],
  options: { minTopSimilarity?: number; responseLanguage?: ResponseLanguage } = {},
): Promise<AnswerMemoryResult> {
  const minTopSimilarity = options.minTopSimilarity ?? MIN_TOP_SIMILARITY;
  const lang = options.responseLanguage ?? 'en';

  if (!chunks.length) {
    const result = noMemoryResult(
      lang === 'vi'
        ? 'Mình chưa tìm thấy ký ức đủ liên quan để trả lời chắc chắn.'
        : 'I couldn\'t find any relevant memories to answer your question.',
      lang,
    );
    result.analytics = {
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: 'n/a' },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
      chunksRetrieved: 0,
      status: 'no_memory',
    };
    return result;
  }

  const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);
  const topSimilarity = sortedChunks[0]?.similarity ?? 0;

  if (topSimilarity < minTopSimilarity || !hasAdequateSemanticSupport(sortedChunks)) {
    const result = noMemoryResult(
      lang === 'vi'
        ? 'Mình tìm thấy một vài ký ức gần nghĩa, nhưng độ liên quan chưa đủ cao để trả lời chắc chắn.'
        : 'I found some loosely related memories, but the relevance isn\'t strong enough for a confident answer.',
      lang,
    );
    result.analytics = {
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: 'n/a' },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
      chunksRetrieved: chunks.length,
      status: 'no_memory',
    };
    return result;
  }

  const sources = buildCitations(sortedChunks);
  // Only send the top 5 most relevant sources to the prompt to reduce input tokens
  const promptSources = sources.slice(0, 5);
  const sourceContext = promptSources
    .map((source) => {
      return [
        `[${source.marker}]`,
        `date: ${source.occurredAt}`,
        `type: ${source.sourceType}/${source.chunkType}`,
        `memory: ${source.quote}`,
      ].join("\n");
    })
    .join("\n\n");

  const languageInstruction = lang === 'vi'
    ? '- PHẢI trả lời bằng tiếng Việt.'
    : '- You MUST answer in English.';

  const prompt = `
You are the grounded answer generator for a personal Second Brain memory system.

Question:
${question}

Retrieved memory sources:
${sourceContext}

Rules:
- Answer ONLY using the retrieved memory sources.
- Do not invent dates, people, events, decisions, emotions, or outcomes.
- Answer naturally without adding any citation markers (like [S1]) in your text.
- However, you MUST still provide the citations in the JSON output with their respective claims.
- Each citations.claim MUST be directly supported by its source and reuse the source's key names, dates, and terms.
- If the sources do not answer the question, say that the memory is insufficient and set confidence to "low".
- Prefer a concise answer over a fluent but unsupported answer.
${languageInstruction}
`.trim();

  try {
    const generateStart = performance.now();
    const geminiResult = await generateGeminiJsonWithMeta({
      model: process.env.GEMINI_ANSWER_MODEL ?? "gemini-2.5-flash",
      prompt,
      responseSchema: GeminiGroundedAnswerResponseSchema,
      validator: GroundedAnswerSchema,
      temperature: 0.1,
      maxOutputTokens: Number(process.env.MEMORY_MAX_ANSWER_TOKENS ?? 1024),
    });
    const generateMs = performance.now() - generateStart;

    const output = geminiResult.data;
    const tokenUsage = geminiResult.tokenUsage;

    const allowedMarkers = new Set(sources.map((source) => source.marker));
    const validModelCitations = output.citations.filter((citation) =>
      allowedMarkers.has(citation.marker),
    );
    const sourceByMarker = new Map(
      sources.map((source) => [source.marker, source]),
    );
    const supportedModelCitations = validModelCitations.filter((citation) => {
      const source = sourceByMarker.get(citation.marker);
      return source ? isClaimSupportedByQuote(citation.claim, source.quote) : false;
    });

    if (!supportedModelCitations.length) {
      const result = noMemoryResult(
        lang === 'vi'
          ? 'Mình tìm thấy một số ký ức liên quan, nhưng câu trả lời sinh ra chưa được evidence/citation chứng minh đủ chắc chắn.'
          : 'I found some related memories, but the generated answer was not grounded strongly enough in the cited evidence.',
        lang,
      );
      result.analytics = {
        tokenUsage,
        timing: { embedMs: 0, retrieveMs: 0, generateMs: Math.round(generateMs), totalMs: 0 },
        chunksRetrieved: chunks.length,
        status: 'no_memory',
      };
      return result;
    }
    const answerGrounded = isAnswerGroundedByCitations(output.answer, supportedModelCitations, sourceByMarker);

    const citedMarkerToClaim = new Map(
      supportedModelCitations.map((citation) => [citation.marker, citation.claim]),
    );

    const citations = sources
      .filter((source) => citedMarkerToClaim.has(source.marker))
      .map((source) => ({
        ...source,
        claim: citedMarkerToClaim.get(source.marker),
      }));

    const retrievalConfidence = classifyRetrievalConfidence(
      topSimilarity,
      citations.length,
    );
    const finalConfidence = reconcileConfidence(
      output.confidence,
      retrievalConfidence,
      output.answer,
      supportedModelCitations.length < validModelCitations.length || !answerGrounded,
    );

    return {
      answer: output.answer,
      confidence: finalConfidence,
      citations,
      analytics: {
        tokenUsage,
        timing: {
          embedMs: 0,
          retrieveMs: 0,
          generateMs: Math.round(generateMs),
          totalMs: 0,
        },
        chunksRetrieved: chunks.length,
        status: 'success',
      },
    };
  } catch (error) {
    const modelError = classifyModelError(error);
    console.warn(
      `[AnswerMemory] Failed to generate grounded answer (${modelError.kind}${modelError.status ? ` ${modelError.status}` : ""}): ${modelError.message}`,
    );

    return {
      answer:
        lang === 'vi'
          ? 'Mình đã tìm thấy ký ức liên quan, nhưng không thể tạo câu trả lời có cấu trúc đáng tin cậy ở lần này.'
          : 'I found relevant memories, but was unable to generate a structured answer this time.',
      confidence: "low",
      citations: [],
      modelError,
      analytics: {
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: 'n/a' },
        timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
        chunksRetrieved: chunks.length,
        status: 'error',
      },
    };
  }
}

function reconcileConfidence(
  modelConfidence: "high" | "medium" | "low",
  retrievalConfidence: "high" | "medium" | "low",
  answer: string,
  hadUnsupportedClaims = false,
): "high" | "medium" | "low" {
  if (hadUnsupportedClaims) return "low";

  if (
    modelConfidence === "low" &&
    retrievalConfidence !== "low" &&
    !isInsufficientAnswer(answer)
  ) {
    return "medium";
  }

  const rank = { low: 0, medium: 1, high: 2 } as const;
  return rank[modelConfidence] <= rank[retrievalConfidence]
    ? modelConfidence
    : retrievalConfidence;
}

function hasAdequateSemanticSupport(chunks: MemorySearchHit[]): boolean {
  const top = chunks[0];
  if (!top) return false;

  if (top.retrievalMode === "lexical" && top.vectorSimilarity < 0.3) {
    return false;
  }

  if (top.retrievalMode === "temporal") {
    return chunks.some((chunk) => chunk.retrievalMode === "temporal");
  }

  return chunks.some((chunk) => chunk.vectorSimilarity >= 0.5);
}

function isClaimSupportedByQuote(claim: string, quote: string): boolean {
  const claimTokens = importantTokens(claim);
  if (claimTokens.length <= 2) return quoteContainsMeaningfulPhrase(claim, quote);

  const quoteTokens = new Set(importantTokens(quote));
  const hits = claimTokens.filter((token) => quoteTokens.has(token)).length;
  const coverage = hits / claimTokens.length;

  return hits >= 2 && coverage >= 0.45;
}

function isAnswerGroundedByCitations(
  answer: string,
  citations: Array<{ marker: string; claim: string }>,
  sourceByMarker: Map<string, MemoryCitation>,
): boolean {
  if (isInsufficientAnswer(answer)) return false;

  const citedEvidence = citations
    .map((citation) => {
      const source = sourceByMarker.get(citation.marker);
      return `${citation.claim} ${source?.quote ?? ""}`;
    })
    .join(" ");
  const answerTokens = importantTokens(answer);

  if (answerTokens.length <= 4) {
    return quoteContainsMeaningfulPhrase(answer, citedEvidence);
  }

  const evidenceTokens = new Set(importantTokens(citedEvidence));
  const hits = answerTokens.filter((token) => evidenceTokens.has(token)).length;
  return hits >= 3 && hits / answerTokens.length >= 0.35;
}

function quoteContainsMeaningfulPhrase(value: string, quote: string): boolean {
  const normalizedValue = normalizeForIntent(value).replace(/[^\p{Letter}\p{Number}\s]/gu, " ");
  const normalizedQuote = normalizeForIntent(quote).replace(/[^\p{Letter}\p{Number}\s]/gu, " ");
  const compactValue = normalizedValue.replace(/\s+/g, " ").trim();
  return compactValue.length >= 4 && normalizedQuote.includes(compactValue);
}

function importantTokens(value: string): string[] {
  const stopwords = new Set([
    "a",
    "an",
    "and",
    "are",
    "about",
    "as",
    "be",
    "but",
    "by",
    "can",
    "cua",
    "cho",
    "co",
    "da",
    "dang",
    "de",
    "did",
    "do",
    "for",
    "from",
    "gi",
    "had",
    "has",
    "have",
    "he",
    "her",
    "his",
    "i",
    "in",
    "is",
    "it",
    "la",
    "lam",
    "me",
    "my",
    "of",
    "on",
    "or",
    "our",
    "she",
    "so",
    "that",
    "the",
    "their",
    "them",
    "they",
    "this",
    "to",
    "toi",
    "trong",
    "va",
    "ve",
    "voi",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "who",
    "why",
    "will",
    "with",
    "you",
  ]);

  return normalizeForIntent(value)
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopwords.has(token));
}

export function inferRetrievalFilters(question: string, now = new Date()): RetrievalFilters {
  const normalized = normalizeForIntent(question);
  const temporalFilters = inferTemporalFilters(normalized, now);

  if (
    includesAny(normalized, [
      "calendar",
      "google calendar",
      "scheduled",
      "appointment",
      "meeting",
      "event",
      "lịch",
      "lich",
      "sự kiện",
      "su kien",
    ])
  ) {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["calendar"],
      preferredChunkTypes: ["event", "general"],
      vectorWeight: 0.6,
      lexicalWeight: 0.4,
    };
  }

  if (includesAny(normalized, ["feedback", "nhận xét", "nhan xet", "góp ý", "gop y"])) {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["diary"],
      preferredChunkTypes: ["feedback", "general", "general_note"],
      vectorWeight: 0.65,
      lexicalWeight: 0.35,
    };
  }

  if (
    includesAny(normalized, [
      "task",
      "action item",
      "follow up",
      "remaining",
      "pending",
      "việc cần",
      "viec can",
      "cần làm",
      "can lam",
    ])
  ) {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["diary"],
      preferredChunkTypes: ["action_item", "task_update", "general", "general_note"],
      vectorWeight: 0.65,
      lexicalWeight: 0.35,
    };
  }

  if (includesAny(normalized, ["diary", "journal", "nhật ký", "nhat ky"])) {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["diary"],
      preferredChunkTypes: ["general", "general_note", "reflection", "event"],
      vectorWeight: 0.65,
      lexicalWeight: 0.35,
    };
  }

  if (includesAny(normalized, ["decide", "decision", "agreed", "quyết định", "quyet dinh", "thống nhất", "thong nhat"])) {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["diary"],
      preferredChunkTypes: ["decision", "general", "general_note"],
      vectorWeight: 0.65,
      lexicalWeight: 0.35,
    };
  }

  return temporalFilters;
}

function inferTemporalFilters(normalizedQuestion: string, now = new Date()): RetrievalFilters {
  const day = 24 * 60 * 60 * 1000;
  const today = startOfUtcDay(now);

  if (includesAny(normalizedQuestion, ["today", "hom nay", "hôm nay"])) {
    return dateRange(today, addDays(today, 1));
  }

  if (includesAny(normalizedQuestion, ["tomorrow", "ngay mai", "ngày mai"])) {
    const start = addDays(today, 1);
    return dateRange(start, addDays(start, 1));
  }

  if (includesAny(normalizedQuestion, ["yesterday", "hom qua", "hôm qua"])) {
    return dateRange(addDays(today, -1), today);
  }

  if (includesAny(normalizedQuestion, ["previous day", "hom truoc", "hôm trước"])) {
    return dateRange(addDays(today, -1), today);
  }

  if (includesAny(normalizedQuestion, ["this week", "tuan nay", "tuần này"])) {
    const start = startOfUtcWeek(today);
    return dateRange(start, addDays(start, 7));
  }

  if (includesAny(normalizedQuestion, ["next week", "following week", "tuan sau", "tuần sau"])) {
    const start = addDays(startOfUtcWeek(today), 7);
    return dateRange(start, addDays(start, 7));
  }

  if (includesAny(normalizedQuestion, ["last week", "previous week", "tuan truoc", "tuần trước"])) {
    const thisWeek = startOfUtcWeek(today);
    return dateRange(addDays(thisWeek, -7), thisWeek);
  }

  if (includesAny(normalizedQuestion, ["this month", "thang nay", "tháng này"])) {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return dateRange(start, new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)));
  }

  if (includesAny(normalizedQuestion, ["next month", "following month", "thang sau", "tháng sau"])) {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    return dateRange(start, new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)));
  }

  if (includesAny(normalizedQuestion, ["last month", "previous month", "thang truoc", "tháng trước"])) {
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
    return dateRange(start, end);
  }

  const explicitDate = detectExplicitDate(normalizedQuestion, today);
  if (explicitDate) {
    return dateRange(explicitDate, addDays(explicitDate, 1));
  }

  const explicitYear = normalizedQuestion.match(/\b(20\d{2})\b/);
  const month = detectMonth(normalizedQuestion);
  if (month !== null) {
    const year = explicitYear
      ? Number(explicitYear[1])
      : normalizedQuestion.includes("last ")
        ? mostRecentPastMonthYear(month, today)
        : today.getUTCFullYear();
    const start = new Date(Date.UTC(year, month, 1));
    return dateRange(start, new Date(Date.UTC(year, month + 1, 1)));
  }

  return {};

  function dateRange(startDate: Date, exclusiveEndDate: Date): RetrievalFilters {
    return {
      startDate,
      endDate: new Date(exclusiveEndDate.getTime() - 1),
    };
  }

  function addDays(date: Date, amount: number): Date {
    return new Date(date.getTime() + amount * day);
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date): Date {
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(date.getTime() + mondayOffset * 24 * 60 * 60 * 1000);
}

function detectMonth(value: string): number | null {
  const months: Array<[number, string[]]> = [
    [0, ["january", "jan", "thang 1", "tháng 1"]],
    [1, ["february", "feb", "thang 2", "tháng 2"]],
    [2, ["march", "mar", "thang 3", "tháng 3"]],
    [3, ["april", "apr", "thang 4", "tháng 4"]],
    [4, ["may", "thang 5", "tháng 5"]],
    [5, ["june", "jun", "thang 6", "tháng 6"]],
    [6, ["july", "jul", "thang 7", "tháng 7"]],
    [7, ["august", "aug", "thang 8", "tháng 8"]],
    [8, ["september", "sep", "thang 9", "tháng 9"]],
    [9, ["october", "oct", "thang 10", "tháng 10"]],
    [10, ["november", "nov", "thang 11", "tháng 11"]],
    [11, ["december", "dec", "thang 12", "tháng 12"]],
  ];

  for (const [month, names] of months) {
    if (names.some((name) => hasNormalizedPhrase(value, name))) {
      return month;
    }
  }

  return null;
}

function detectExplicitDate(value: string, now: Date): Date | null {
  const numericDate = value.match(
    /(?:^|[^\d])(?:ngay\s+)?([0-3]?\d)\s*[\/.-]\s*([01]?\d)(?:\s*[\/.-]\s*(20\d{2}|\d{2}))?(?=$|[^\d])/u,
  );
  if (numericDate) {
    const date = buildUtcDateFromParts(
      Number(numericDate[1]),
      Number(numericDate[2]),
      numericDate[3],
      now,
    );
    if (date) return date;
  }

  const vietnameseDate = value.match(
    /(?:^|\s)(?:ngay\s+)?([0-3]?\d)\s+thang\s+([01]?\d)(?:\s+nam\s+(20\d{2}|\d{2}))?(?=$|\s)/u,
  );
  if (vietnameseDate) {
    const date = buildUtcDateFromParts(
      Number(vietnameseDate[1]),
      Number(vietnameseDate[2]),
      vietnameseDate[3],
      now,
    );
    if (date) return date;
  }

  const isoDate = value.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/u);
  if (isoDate) {
    return buildUtcDateFromParts(
      Number(isoDate[3]),
      Number(isoDate[2]),
      isoDate[1],
      now,
    );
  }

  return null;
}

function buildUtcDateFromParts(
  day: number,
  monthOneBased: number,
  rawYear: string | undefined,
  now: Date,
): Date | null {
  const year = rawYear
    ? rawYear.length === 2
      ? 2000 + Number(rawYear)
      : Number(rawYear)
    : now.getUTCFullYear();
  const month = monthOneBased - 1;

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    month < 0 ||
    month > 11 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function hasNormalizedPhrase(value: string, phrase: string): boolean {
  const normalizedValue = value
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalizedPhrase = normalizeForIntent(phrase)
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}($|\\s)`, "u").test(normalizedValue);
}

function mostRecentPastMonthYear(month: number, now: Date): number {
  return month <= now.getUTCMonth() ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

function normalizeForIntent(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(normalizeForIntent(needle)));
}

function isInsufficientAnswer(answer: string): boolean {
  const normalized = normalizeForIntent(answer);
  return includesAny(normalized, [
    "insufficient",
    "not enough",
    "not found",
    "khong du",
    "chua tim thay",
    "khong tim thay",
  ]);
}

function classifyModelError(
  error: unknown,
): NonNullable<AnswerMemoryResult["modelError"]> {
  const status = typeof (error as { status?: unknown })?.status === "number"
    ? (error as { status: number }).status
    : undefined;
  const message = error instanceof Error ? error.message : String(error);

  if (status === 429 || message.includes("429")) {
    return { status: status ?? 429, kind: "quota", message: summarizeError(message) };
  }

  if (status === 503 || message.includes("503")) {
    return {
      status: status ?? 503,
      kind: "service_unavailable",
      message: summarizeError(message),
    };
  }

  if (error && typeof error === "object" && error.constructor?.name === "ZodError") {
    return { kind: "validation", message: summarizeError(message) };
  }

  if (
    message.includes("500") ||
    message.includes("ECONNRESET") ||
    message.includes("fetch failed")
  ) {
    return { status, kind: "transient", message: summarizeError(message) };
  }

  return { status, kind: "unknown", message: summarizeError(message) };
}

function summarizeError(message: string): string {
  return message.replace(/\s+/g, " ").slice(0, 240);
}

function buildDebugTrace(input: {
  question: string;
  inferredFilters: RetrievalFilters;
  appliedFilters: RetrievalFilters;
  chunks: MemorySearchHit[];
  result: AnswerMemoryResult;
}): MemoryDebugTrace {
  return {
    question: input.question,
    inferredFilters: serializeFilters(input.inferredFilters),
    appliedFilters: serializeFilters(input.appliedFilters),
    status: input.result.analytics?.status ?? "error",
    reason: explainResult(input.result, input.chunks),
    chunksRetrieved: input.chunks.length,
    topChunks: buildCitations([...input.chunks].sort((a, b) => b.similarity - a.similarity))
      .slice(0, 8)
      .map((citation) => ({
        id: citation.chunkId,
        sourceType: citation.sourceType,
        sourceId: citation.sourceId,
        sourceTitle: citation.sourceTitle,
        chunkType: citation.chunkType,
        occurredAt: citation.occurredAt,
        retrievalMode: citation.retrievalMode ?? "unknown",
        similarity: roundScore(citation.similarity),
        vectorSimilarity: roundScore(citation.vectorSimilarity ?? 0),
        lexicalScore: roundScore(citation.lexicalScore ?? 0),
        distance:
          input.chunks.find((chunk) => chunk.id === citation.chunkId)?.distance ?? null,
        quote: citation.quote,
      })),
  };
}

function serializeFilters(filters: RetrievalFilters): Record<string, unknown> {
  const entries = Object.entries(filters).filter(([, value]) => value !== undefined);
  return Object.fromEntries(
    entries.map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  );
}

function explainResult(result: AnswerMemoryResult, chunks: MemorySearchHit[]): string {
  if (result.analytics?.status === "success") {
    if (result.analytics.tokenUsage.model === "fast-path") {
      return "Answer assembled from single-day retrieved chunks without model generation.";
    }

    return "Answer generated with supported citations.";
  }

  if (!chunks.length) {
    return "Retrieval returned zero chunks after filters and thresholds.";
  }

  if (result.citations.length === 0 && result.analytics?.tokenUsage.totalTokens) {
    return "Chunks were retrieved, but the generated answer did not pass citation/evidence validation.";
  }

  if (result.noMemory) {
    return "Chunks were retrieved, but top similarity or semantic support was below the answer threshold.";
  }

  if (result.analytics?.status === "error") {
    return result.modelError
      ? `Model error: ${result.modelError.kind}`
      : "Answer generation failed after retrieval.";
  }

  return "Memory search completed with low confidence.";
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function noMemoryResult(message: string, lang: ResponseLanguage): AnswerMemoryResult {
  const suggestions = lang === 'vi'
    ? [
        'Thêm nhật ký mới về chủ đề này',
        'Thử diễn đạt lại câu hỏi',
        'Đồng bộ Google Calendar để thêm ký ức',
      ]
    : [
        'Add a new diary entry about this topic',
        'Try rephrasing your question',
        'Sync your Google Calendar for more memories',
      ];

  return {
    answer: message,
    confidence: "low",
    citations: [],
    noMemory: true,
    suggestions,
  };
}
