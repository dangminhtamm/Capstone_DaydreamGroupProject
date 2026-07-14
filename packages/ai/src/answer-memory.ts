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
const DEFAULT_PROMPT_SOURCE_LIMIT = Number(process.env.MEMORY_PROMPT_SOURCE_LIMIT ?? 4);
const DEFAULT_MAX_ANSWER_TOKENS = Number(process.env.MEMORY_MAX_ANSWER_TOKENS ?? 512);
const DEFAULT_REASONING_MAX_ANSWER_TOKENS = Number(
  process.env.MEMORY_REASONING_MAX_ANSWER_TOKENS ??
    Math.max(DEFAULT_MAX_ANSWER_TOKENS, 768),
);
const DEFAULT_RETRIEVAL_CANDIDATE_LIMIT = Number(process.env.MEMORY_RETRIEVAL_CANDIDATE_LIMIT ?? 12);

const GroundedCitationSchema = z.object({
  marker: z.preprocess(normalizeCitationMarker, z.string().regex(/^S\d+$/)),
  claim: z.preprocess(
    normalizeCitationClaim,
    z.string().min(1).describe("The specific claim supported by this source"),
  ),
});

const GroundedAnswerSchema = z.object({
  answer: z.preprocess(normalizeAnswerText, z.string().min(1)),
  confidence: z.preprocess(normalizeModelConfidence, z.enum(["high", "medium", "low"])),
  citations: z.preprocess(normalizeModelCitations, z.array(GroundedCitationSchema)),
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
  answerMode: AnswerMode;
}

export type AnswerMode =
  | "cache"
  | "fast_path"
  | "gemini"
  | "extractive_fallback"
  | "no_memory";

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
  answerMode: AnswerMode;
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
export type AnswerStrategy = "auto" | "fast" | "deep";

export interface AnswerMemoryOptions {
  filters?: RetrievalFilters;
  limit?: number;
  maxDistance?: number;
  minTopSimilarity?: number;
  responseLanguage?: ResponseLanguage;
  answerStrategy?: AnswerStrategy;
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
  const answerStrategy = options.answerStrategy ?? "auto";

  if (!normalizedQuestion) {
    return noMemoryResult(lang === 'vi' ? 'Bạn chưa nhập câu hỏi.' : 'Please enter a question.', lang);
  }

  const inferredFilters = inferRetrievalFilters(normalizedQuestion);
  const appliedFilters = {
    ...inferredFilters,
    ...options.filters,
    limit: Math.min(
      Math.max(options.limit ?? DEFAULT_RETRIEVAL_CANDIDATE_LIMIT, DEFAULT_RETRIEVAL_CANDIDATE_LIMIT),
      20,
    ),
    maxDistance: options.maxDistance ?? DEFAULT_MAX_DISTANCE,
  };

  const preRetrieveStart = performance.now();
  const unindexedDiaryChunks = await retrieveUnindexedDiaryFallbackHits(
    dbClient,
    userId,
    appliedFilters,
  );
  const preRetrieveMs = performance.now() - preRetrieveStart;

  const unindexedFastPathResult = answerStrategy === "deep"
    ? null
    : answerSingleDayFastPath(
        normalizedQuestion,
        unindexedDiaryChunks,
        appliedFilters,
        lang,
        options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
      ) ?? answerTemporalRangeFastPath(
        normalizedQuestion,
        unindexedDiaryChunks,
        appliedFilters,
        lang,
        options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
      );
  if (unindexedFastPathResult) {
    if (unindexedFastPathResult.analytics) {
      unindexedFastPathResult.analytics.timing.embedMs = 0;
      unindexedFastPathResult.analytics.timing.retrieveMs = Math.round(preRetrieveMs);
      unindexedFastPathResult.analytics.timing.totalMs = Math.round(performance.now() - totalStart);
      unindexedFastPathResult.analytics.tokenUsage.model =
        unindexedFastPathResult.analytics.tokenUsage.model === "temporal-fast-path"
          ? "unindexed-diary-temporal-fast-path"
          : "unindexed-diary-fast-path";
    }

    unindexedFastPathResult.debugTrace = buildDebugTrace({
      question: normalizedQuestion,
      inferredFilters,
      appliedFilters,
      chunks: unindexedDiaryChunks,
      result: unindexedFastPathResult,
    });

    return unindexedFastPathResult;
  }

  // ── Embed + Retrieve ─────────────────────────────────────────────────────
  const embedStart = performance.now();
  let embedding: number[];
  try {
    embedding = await createDefaultEmbeddingProvider().embedQuery(normalizedQuestion);
  } catch (error) {
    const embedMs = performance.now() - embedStart;
    const modelError = classifyModelError(error);
    const fallbackSources = buildCitations(unindexedDiaryChunks);
    const result = fallbackSources.length
      ? buildExtractiveFallbackAnswer(lang, fallbackSources, unindexedDiaryChunks.length, modelError)
      : noMemoryResult(
          lang === 'vi'
            ? 'Gemini đang bị giới hạn quota/rate limit nên mình chưa thể tìm kiếm AI lúc này.'
            : 'Gemini is currently quota/rate limited, so AI search is unavailable right now.',
          lang,
        );

    result.modelError = modelError;
    result.analytics = result.analytics ?? {
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: 'n/a' },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
      chunksRetrieved: unindexedDiaryChunks.length,
      status: 'error',
      answerMode: result.answerMode,
    };
    result.analytics.timing.embedMs = Math.round(embedMs);
    result.analytics.timing.retrieveMs = Math.round(preRetrieveMs);
    result.analytics.timing.totalMs = Math.round(performance.now() - totalStart);
    result.analytics.status = 'error';

    result.debugTrace = buildDebugTrace({
      question: normalizedQuestion,
      inferredFilters,
      appliedFilters,
      chunks: unindexedDiaryChunks,
      result,
    });

    return result;
  }
  const embedMs = performance.now() - embedStart;

  const retrieveStart = performance.now();
  const retrievedChunks = rerankMemoryHits(
    normalizedQuestion,
    await retrieveMemoryWithEmbedding(
      normalizedQuestion,
      userId,
      dbClient,
      embedding,
      appliedFilters,
    ),
    appliedFilters,
  );
  const chunks = rerankMemoryHits(
    normalizedQuestion,
    [...unindexedDiaryChunks, ...retrievedChunks],
    appliedFilters,
  );
  const retrieveMs = performance.now() - retrieveStart;

  const fastPathResult = answerStrategy === "deep"
    ? null
    : answerSingleDayFastPath(
        normalizedQuestion,
        chunks,
        appliedFilters,
        lang,
        options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
      ) ?? answerTemporalRangeFastPath(
        normalizedQuestion,
        chunks,
        appliedFilters,
        lang,
        options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
      );

  const result = fastPathResult ??
    (answerStrategy === "fast"
      ? answerFastExtractiveFromChunks(
          chunks,
          lang,
          options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
        )
      : await answerFromChunks(normalizedQuestion, chunks, {
    minTopSimilarity: options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
    responseLanguage: lang,
    answerStrategy,
  }));

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
    answerMode: "fast_path",
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
      answerMode: "fast_path",
    },
  };
}

export function answerTemporalRangeFastPath(
  question: string,
  chunks: MemorySearchHit[],
  filters: RetrievalFilters,
  lang: ResponseLanguage,
  minTopSimilarity: number,
): AnswerMemoryResult | null {
  if (
    !isMultiDayRange(filters) ||
    !chunks.length ||
    requiresGenerativeReasoning(question) ||
    process.env.MEMORY_TEMPORAL_FAST_PATH === "false"
  ) {
    return null;
  }

  const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);
  const topSimilarity = sortedChunks[0]?.similarity ?? 0;
  if (topSimilarity < minTopSimilarity || !hasAdequateSemanticSupport(sortedChunks)) {
    return null;
  }

  const citations = dedupeCitationsBySource(buildCitations(sortedChunks))
    .slice(0, 6)
    .map((citation) => ({
      ...citation,
      claim: buildReadableClaim(citation),
    }));

  if (!citations.length) return null;

  const answer = formatTemporalRangeAnswer(
    citations,
    formatDateRangeForAnswer(filters.startDate!, filters.endDate!, lang),
    lang,
  );
  const confidence = classifyRetrievalConfidence(topSimilarity, citations.length);

  return {
    answer,
    confidence,
    citations,
    answerMode: "fast_path",
    analytics: {
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: "temporal-fast-path",
      },
      timing: {
        embedMs: 0,
        retrieveMs: 0,
        generateMs: 0,
        totalMs: 0,
      },
      chunksRetrieved: chunks.length,
      status: "success",
      answerMode: "fast_path",
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

function isMultiDayRange(filters: RetrievalFilters): boolean {
  if (!filters.startDate || !filters.endDate) return false;
  const start = filters.startDate.getTime();
  const end = filters.endDate.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;

  return end - start > 24 * 60 * 60 * 1000;
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
  const lines = citations.map((citation) => `- ${formatMemoryBullet(citation)}.`);

  if (lang === 'vi') {
    return [
      `Vào ${dateLabel}, mình tìm thấy các ký ức nổi bật sau:`,
      ...lines,
    ].join('\n');
  }

  return [
    `On ${dateLabel}, I found these memories:`,
    ...lines,
  ].join('\n');
}

function formatTemporalRangeAnswer(
  citations: MemoryCitation[],
  rangeLabel: string,
  lang: ResponseLanguage,
): string {
  const lines = citations.map((citation) => {
    const date = formatFallbackSourceDate(citation.occurredAt, lang);
    return `- ${date}: ${formatMemoryBullet(citation)}.`;
  });

  if (lang === "vi") {
    return [
      `Dựa trên các ký ức đã lưu, trong ${rangeLabel} bạn có một số hoạt động/chủ đề nổi bật:`,
      ...lines,
    ].join("\n");
  }

  return [
    `Based on your saved memories, these were the notable activities/themes during ${rangeLabel}:`,
    ...lines,
  ].join("\n");
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

function formatDateRangeForAnswer(startDate: Date, endDate: Date, lang: ResponseLanguage): string {
  const start = formatDateForAnswer(startDate, lang);
  const end = formatDateForAnswer(endDate, lang);
  if (start === end) return start;
  return lang === "vi" ? `${start} đến ${end}` : `${start} to ${end}`;
}

function trimTrailingPunctuation(value: string): string {
  return value.trim().replace(/[.!?。！？]+$/u, '');
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function dedupeCitationsBySource(citations: MemoryCitation[]): MemoryCitation[] {
  const seen = new Set<string>();
  const deduped: MemoryCitation[] = [];

  for (const citation of citations) {
    const key = `${citation.sourceType}:${citation.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(citation);
  }

  return deduped;
}

function buildReadableClaim(citation: MemoryCitation): string {
  return trimPromptQuote(formatMemoryBullet(citation), 220);
}

function formatMemoryBullet(citation: MemoryCitation): string {
  return sentenceCase(trimTrailingPunctuation(cleanMemoryText(citation.quote)));
}

function cleanMemoryText(text: string): string {
  return trimPromptQuote(
    text
      .replace(/\s+/g, " ")
      .replace(/^(diary entry|journal entry|nhat ky|nhật ký)(\s+h[oô]m nay|\s+today)?\s*[:\-–—]?\s*/i, "")
      .trim(),
    240,
  );
}

function selectPromptSourceLimit(question: string): number {
  const configured = Math.min(Math.max(DEFAULT_PROMPT_SOURCE_LIMIT, 2), 6);
  if (!requiresGenerativeReasoning(question)) return configured;
  return Math.max(configured, 6);
}

function selectMaxAnswerTokens(question: string): number {
  const configured = Math.min(Math.max(DEFAULT_MAX_ANSWER_TOKENS, 256), 2048);
  if (!requiresGenerativeReasoning(question)) return configured;
  return Math.min(
    Math.max(DEFAULT_REASONING_MAX_ANSWER_TOKENS, configured),
    2048,
  );
}

export async function answerFromChunks(
  question: string,
  chunks: MemorySearchHit[],
  options: {
    minTopSimilarity?: number;
    responseLanguage?: ResponseLanguage;
    answerStrategy?: AnswerStrategy;
    generateAnswer?: typeof generateGeminiJsonWithMeta<z.infer<typeof GroundedAnswerSchema>>;
  } = {},
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
      answerMode: "no_memory",
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
      answerMode: "no_memory",
    };
    return result;
  }

  if (options.answerStrategy === "fast") {
    return answerFastExtractiveFromChunks(chunks, lang, minTopSimilarity);
  }

  const sources = buildCitations(sortedChunks);
  const promptSourceLimit = selectPromptSourceLimit(question);
  const promptSources = sources.slice(0, promptSourceLimit);
  const sourceContext = promptSources
    .map((source) => {
      return [
        `[${source.marker}]`,
        `date: ${source.occurredAt}`,
        `type: ${source.sourceType}/${source.chunkType}`,
        `memory: ${trimPromptQuote(source.quote)}`,
      ].join("\n");
    })
    .join("\n\n");

  const languageInstruction = lang === 'vi'
    ? '- PHẢI trả lời bằng tiếng Việt tự nhiên. Dùng "mình" cho assistant và "bạn" cho user.'
    : '- You MUST answer in natural English.';

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
- Prefer a warm, concise answer over a fluent but unsupported answer.
- For "what did I do" timeline/range questions, summarize the main activities first, then use short bullets only when helpful.
- Do not mention Gemini, model errors, retrieval, debug trace, or implementation details.
- Return a compact JSON object with exactly these top-level fields: answer, confidence, citations.
${languageInstruction}
`.trim();

  try {
    const generateStart = performance.now();
    const geminiResult = await (options.generateAnswer ?? generateGeminiJsonWithMeta)({
      model: process.env.GEMINI_ANSWER_MODEL ?? "gemini-2.5-flash",
      prompt,
      responseSchema: GeminiGroundedAnswerResponseSchema,
      validator: GroundedAnswerSchema,
      temperature: 0.1,
      maxOutputTokens: selectMaxAnswerTokens(question),
    });
    const generateMs = performance.now() - generateStart;

    const output = geminiResult.data;
    const tokenUsage = geminiResult.tokenUsage;

    const allowedMarkers = new Set(promptSources.map((source) => source.marker));
    const validModelCitations = output.citations.filter((citation) =>
      allowedMarkers.has(citation.marker),
    );
    const sourceByMarker = new Map(
      promptSources.map((source) => [source.marker, source]),
    );
    const supportedModelCitations = validModelCitations.filter((citation) => {
      const source = sourceByMarker.get(citation.marker);
      return source ? isClaimSupportedByQuote(citation.claim, source.quote) : false;
    });

    if (!supportedModelCitations.length && isInsufficientAnswer(output.answer)) {
      return buildInsufficientModelAnswer(lang, output.answer, chunks.length, {
        generateMs: Math.round(generateMs),
        tokenUsage,
      });
    }

    if (!supportedModelCitations.length) {
      return buildExtractiveFallbackAnswer(
        lang,
        promptSources,
        chunks.length,
        {
          kind: "validation",
          message: "Generated answer did not include usable grounded citations.",
        },
        {
          generateMs: Math.round(generateMs),
          tokenUsage,
        },
      );
    }
    const answerGrounded = isAnswerGroundedByCitations(output.answer, supportedModelCitations, sourceByMarker);

    const citedMarkerToClaim = new Map(
      supportedModelCitations.map((citation) => [citation.marker, citation.claim]),
    );

    const citations = promptSources
      .filter((source) => citedMarkerToClaim.has(source.marker))
      .map((source) => ({
        ...source,
        claim: citedMarkerToClaim.get(source.marker),
      }));

    const retrievalConfidence = classifyRetrievalConfidence(
      topSimilarity,
      citations.length,
    );
    if (!answerGrounded) {
      return buildExtractiveFallbackAnswer(
        lang,
        promptSources,
        chunks.length,
        {
          kind: "validation",
          message: "Generated answer was not sufficiently grounded in its citations.",
        },
        {
          generateMs: Math.round(generateMs),
          tokenUsage,
        },
      );
    }

    const finalConfidence = reconcileConfidence(
      output.confidence,
      retrievalConfidence,
      output.answer,
      supportedModelCitations.length < validModelCitations.length,
    );

    return {
      answer: output.answer,
      confidence: finalConfidence,
      citations,
      answerMode: "gemini",
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
        answerMode: "gemini",
      },
    };
  } catch (error) {
    const modelError = classifyModelError(error);
    console.warn(
      `[AnswerMemory] Failed to generate grounded answer (${modelError.kind}${modelError.status ? ` ${modelError.status}` : ""}): ${modelError.message}`,
    );

    if (canUseExtractiveFallback(modelError, promptSources)) {
      return buildExtractiveFallbackAnswer(lang, promptSources, chunks.length, modelError);
    }

    return {
      answer:
        lang === 'vi'
          ? 'Mình đã tìm thấy ký ức liên quan, nhưng không thể tạo câu trả lời có cấu trúc đáng tin cậy ở lần này.'
          : 'I found relevant memories, but was unable to generate a structured answer this time.',
      confidence: "low",
      citations: [],
      answerMode: "extractive_fallback",
      modelError,
      analytics: {
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: 'n/a' },
        timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
        chunksRetrieved: chunks.length,
        status: 'error',
        answerMode: "extractive_fallback",
      },
    };
  }
}

function canUseExtractiveFallback(
  modelError: NonNullable<AnswerMemoryResult["modelError"]>,
  sources: MemoryCitation[],
): boolean {
  return (
    sources.length > 0 &&
    ["quota", "service_unavailable", "transient", "validation"].includes(modelError.kind)
  );
}

function buildExtractiveFallbackAnswer(
  lang: ResponseLanguage,
  sources: MemoryCitation[],
  chunksRetrieved: number,
  modelError: NonNullable<AnswerMemoryResult["modelError"]>,
  meta: {
    generateMs?: number;
    tokenUsage?: GeminiTokenUsage;
  } = {},
): AnswerMemoryResult {
  const fallbackSources = dedupeCitationsBySource(sources).slice(0, 4).map((source) => ({
    ...source,
    claim: buildReadableClaim(source),
  }));

  const bullets = fallbackSources
    .map((source) => {
      const date = formatFallbackSourceDate(source.occurredAt, lang);
      return `- ${date}: ${formatMemoryBullet(source)}.`;
    })
    .join("\n");

  const answer = lang === 'vi'
    ? [
        modelError.kind === "validation"
          ? formatValidationFallbackLead(modelError.message, lang)
          : "Mình trả lời nhanh bằng các ký ức liên quan đã tìm được.",
        "Các điểm nổi bật:",
        bullets,
      ].join("\n")
    : [
        modelError.kind === "validation"
          ? formatValidationFallbackLead(modelError.message, lang)
          : "I am answering directly from the relevant retrieved memories.",
        "Key points:",
        bullets,
      ].join("\n");

  return {
    answer,
    confidence: "low",
    citations: fallbackSources,
    answerMode: "extractive_fallback",
    modelError,
    analytics: {
      tokenUsage: meta.tokenUsage ?? {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: "extractive-fallback",
      },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: meta.generateMs ?? 0, totalMs: 0 },
      chunksRetrieved,
      status: "success",
      answerMode: "extractive_fallback",
    },
  };
}

function answerFastExtractiveFromChunks(
  chunks: MemorySearchHit[],
  lang: ResponseLanguage,
  minTopSimilarity: number,
): AnswerMemoryResult {
  if (!chunks.length) {
    const result = noMemoryResult(
      lang === "vi"
        ? "Mình chưa tìm thấy ký ức đủ liên quan để trả lời nhanh."
        : "I could not find enough relevant memories for a fast answer.",
      lang,
    );
    result.analytics = {
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: "fast-extractive" },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
      chunksRetrieved: 0,
      status: "no_memory",
      answerMode: "no_memory",
    };
    return result;
  }

  const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);
  const topSimilarity = sortedChunks[0]?.similarity ?? 0;
  if (topSimilarity < minTopSimilarity || !hasAdequateSemanticSupport(sortedChunks)) {
    const result = noMemoryResult(
      lang === "vi"
        ? "Mình tìm thấy một vài ký ức gần nghĩa, nhưng chưa đủ chắc để trả lời nhanh."
        : "I found loosely related memories, but not enough support for a fast answer.",
      lang,
    );
    result.analytics = {
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: "fast-extractive" },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
      chunksRetrieved: chunks.length,
      status: "no_memory",
      answerMode: "no_memory",
    };
    return result;
  }

  const citations = dedupeCitationsBySource(buildCitations(sortedChunks))
    .slice(0, 6)
    .map((citation) => ({
      ...citation,
      claim: buildReadableClaim(citation),
    }));

  const bullets = citations
    .map((citation) => {
      const date = formatFallbackSourceDate(citation.occurredAt, lang);
      return `- ${date}: ${formatMemoryBullet(citation)}.`;
    })
    .join("\n");

  return {
    answer: lang === "vi"
      ? ["Mình trả lời nhanh từ các ký ức liên quan nhất:", bullets].join("\n")
      : ["Fast answer from the most relevant memories:", bullets].join("\n"),
    confidence: classifyRetrievalConfidence(topSimilarity, citations.length),
    citations,
    answerMode: "fast_path",
    analytics: {
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: "fast-extractive" },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
      chunksRetrieved: chunks.length,
      status: "success",
      answerMode: "fast_path",
    },
  };
}

function buildInsufficientModelAnswer(
  lang: ResponseLanguage,
  answer: string,
  chunksRetrieved: number,
  meta: {
    generateMs: number;
    tokenUsage: GeminiTokenUsage;
  },
): AnswerMemoryResult {
  return {
    answer: normalizeInsufficientAnswer(answer, lang),
    confidence: "low",
    citations: [],
    noMemory: true,
    answerMode: "gemini",
    analytics: {
      tokenUsage: meta.tokenUsage,
      timing: { embedMs: 0, retrieveMs: 0, generateMs: meta.generateMs, totalMs: 0 },
      chunksRetrieved,
      status: "no_memory",
      answerMode: "gemini",
    },
  };
}

function normalizeInsufficientAnswer(answer: string, lang: ResponseLanguage): string {
  const trimmed = answer.trim();
  if (trimmed) return trimmed;
  return lang === "vi"
    ? "Mình chưa tìm thấy ký ức đủ cụ thể để trả lời chắc chắn."
    : "I could not find enough specific memories to answer confidently.";
}

function formatValidationFallbackLead(message: string, lang: ResponseLanguage): string {
  const normalized = message.toLowerCase();
  const isGroundingIssue =
    normalized.includes("grounded") ||
    normalized.includes("citation") ||
    normalized.includes("usable");

  if (lang === "vi") {
    return isGroundingIssue
      ? "Citation chưa đủ chắc, nên mình dùng trực tiếp các ký ức liên quan nhất."
      : "Câu trả lời có cấu trúc chưa ổn định, nên mình dùng trực tiếp các ký ức liên quan nhất.";
  }

  return isGroundingIssue
    ? "The generated citations were not grounded enough, so I am using the most relevant memories directly."
    : "The structured answer was unstable, so I am using the most relevant grounded memories directly.";
}

function formatFallbackSourceDate(value: string, lang: ResponseLanguage): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return formatDateForAnswer(date, lang);
}

type UnindexedDiaryRow = {
  id: string;
  raw_text: string;
  entry_date: Date | string | null;
  created_at: Date | string;
  job_status: string | null;
};

async function retrieveUnindexedDiaryFallbackHits(
  dbClient: MemoryDbClient,
  userId: string,
  filters: RetrievalFilters,
): Promise<MemorySearchHit[]> {
  if (!shouldReadUnindexedDiaries(filters)) return [];

  const queryRawUnsafe = (dbClient as {
    $queryRawUnsafe?: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
  }).$queryRawUnsafe?.bind(dbClient);
  if (!queryRawUnsafe) return [];

  let rows: UnindexedDiaryRow[] = [];
  try {
    rows = await queryRawUnsafe<UnindexedDiaryRow[]>(
      `
        SELECT
          d.id,
          d.raw_text,
          d.entry_date,
          d.created_at,
          j.status AS job_status
        FROM diary_entries d
        LEFT JOIN indexing_outbox j
          ON j.job_type = 'index_memory'
         AND j.source_type = 'diary'
         AND j.source_id = d.id
        WHERE d.user_id = $1
          AND (
            d.entry_date BETWEEN $2 AND $3
            OR (d.entry_date IS NULL AND d.created_at BETWEEN $2 AND $3)
          )
          AND NOT EXISTS (
            SELECT 1
            FROM memory_chunks m
            WHERE m.user_id = d.user_id
              AND m.source_type = 'diary'
              AND m.source_id = d.id
          )
        ORDER BY COALESCE(d.entry_date, d.created_at) DESC, d.created_at DESC
        LIMIT $4
      `,
      userId,
      filters.startDate,
      filters.endDate,
      Math.min(filters.limit ?? 8, 8),
    );
  } catch (error) {
    console.warn("[AnswerMemory] Unindexed diary fallback failed:", error);
    return [];
  }

  return rows
    .map((row, index) => buildUnindexedDiaryHit(row, index))
    .filter((hit): hit is MemorySearchHit => hit !== null);
}

function shouldReadUnindexedDiaries(filters: RetrievalFilters): boolean {
  if (!filters.startDate || !filters.endDate) return false;
  if (filters.sourceType && filters.sourceType !== "diary") return false;
  if (filters.sourceTypes?.length && !filters.sourceTypes.includes("diary")) return false;
  if (
    filters.preferredSourceTypes?.length &&
    !filters.preferredSourceTypes.includes("diary")
  ) {
    return false;
  }

  return true;
}

function buildUnindexedDiaryHit(row: UnindexedDiaryRow, index: number): MemorySearchHit | null {
  const rawText = row.raw_text.trim();
  if (!rawText) return null;

  const title = extractDiaryTitle(rawText);
  const occurredAt = row.entry_date ? new Date(row.entry_date) : new Date(row.created_at);

  return {
    id: `unindexed-diary:${row.id}`,
    sourceType: "diary",
    sourceId: row.id,
    chunkType: "general",
    text: trimPromptQuote(rawText, 1200),
    evidence: trimPromptQuote(rawText, 600),
    metadata: {
      sourceType: "diary",
      sourceId: row.id,
      sourceTitle: title,
      chunkIndex: index,
      chunkType: "general",
      date: occurredAt.toISOString(),
      indexingStatus: row.job_status ?? "missing",
      fallback: "unindexed_diary",
    },
    occurredAt,
    distance: null,
    vectorSimilarity: 0,
    lexicalScore: 1,
    retrievalMode: "temporal",
    similarity: 0.72,
  };
}

function extractDiaryTitle(rawText: string): string {
  const firstLine = rawText.split(/\r?\n/, 1)[0]?.trim();
  if (!firstLine) return "Diary entry";
  return trimPromptQuote(firstLine, 80);
}

export function rerankMemoryHits(
  question: string,
  chunks: MemorySearchHit[],
  filters: RetrievalFilters = {},
): MemorySearchHit[] {
  if (chunks.length <= 1) return chunks;

  const queryTokens = new Set(importantTokens(question));
  const latestTimestamp = Math.max(
    ...chunks.map((chunk) => new Date(chunk.occurredAt).getTime()).filter(Number.isFinite),
  );
  const hasPrimarySources = chunks.some((chunk) => chunk.sourceType !== "summary");
  const recentIntent = hasRecentIntent(question);
  const preferredSourceTypes = new Set(filters.preferredSourceTypes ?? []);
  const preferredChunkTypes = new Set(filters.preferredChunkTypes ?? []);

  return chunks
    .map((chunk) => {
      const evidenceTokens = new Set(importantTokens(`${chunk.text} ${chunk.evidence ?? ""}`));
      const titleTokens = new Set(importantTokens(getMetadataString(chunk.metadata, "sourceTitle")));
      const overlap = countOverlap(queryTokens, evidenceTokens);
      const titleOverlap = countOverlap(queryTokens, titleTokens);
      const overlapRatio = queryTokens.size ? overlap / queryTokens.size : 0;
      const titleRatio = queryTokens.size ? titleOverlap / queryTokens.size : 0;
      const occurredAt = new Date(chunk.occurredAt).getTime();
      const ageDays = Number.isFinite(occurredAt) && Number.isFinite(latestTimestamp)
        ? Math.max(0, (latestTimestamp - occurredAt) / (24 * 60 * 60 * 1000))
        : 0;
      const recencyBoost = recentIntent ? Math.max(0, 0.08 - ageDays * 0.01) : 0;
      const preferredSourceBoost = preferredSourceTypes.has(chunk.sourceType) ? 0.06 : 0;
      const preferredChunkBoost = preferredChunkTypes.has(chunk.chunkType) ? 0.05 : 0;
      const lexicalBoost = Math.min(0.1, overlapRatio * 0.1);
      const titleBoost = Math.min(0.04, titleRatio * 0.04);
      const summaryPenalty = hasPrimarySources && chunk.sourceType === "summary" ? 0.06 : 0;

      return {
        ...chunk,
        similarity: clampScore(
          chunk.similarity +
            recencyBoost +
            preferredSourceBoost +
            preferredChunkBoost +
            lexicalBoost +
            titleBoost -
            summaryPenalty,
        ),
      };
    })
    .sort((a, b) => b.similarity - a.similarity || b.occurredAt.getTime() - a.occurredAt.getTime());
}

function trimPromptQuote(text: string, maxLength = 420): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function countOverlap(first: Set<string>, second: Set<string>): number {
  let hits = 0;
  for (const token of first) {
    if (second.has(token)) hits += 1;
  }
  return hits;
}

function getMetadataString(metadata: unknown, key: string): string {
  if (!metadata || typeof metadata !== "object") return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function hasRecentIntent(question: string): boolean {
  const normalized = normalizeForIntent(question);
  return includesAny(normalized, [
    "recent",
    "recently",
    "latest",
    "last few",
    "lately",
    "gan day",
    "gần đây",
    "moi day",
    "mới đây",
    "moi nhat",
    "mới nhất",
  ]);
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeModelConfidence(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return "low";
  if (typeof value === "number") {
    if (value >= 0.75) return "high";
    if (value >= 0.4) return "medium";
    return "low";
  }
  if (typeof value !== "string") return value;
  const normalized = normalizeForIntent(value).trim();

  if (
    normalized === "high" ||
    normalized.includes("high") ||
    normalized.includes("cao")
  ) {
    return "high";
  }

  if (
    normalized === "medium" ||
    normalized.includes("medium") ||
    normalized.includes("moderate") ||
    normalized.includes("trung binh") ||
    normalized.includes("vua")
  ) {
    return "medium";
  }

  if (
    normalized === "low" ||
    normalized.includes("low") ||
    normalized.includes("thap") ||
    normalized.includes("yeu")
  ) {
    return "low";
  }

  return "low";
}

function normalizeAnswerText(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join("\n");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["answer", "text", "response", "summary", "content"]) {
      if (typeof record[key] === "string") return record[key].trim();
    }
  }
  return value;
}

function normalizeModelCitations(value: unknown): unknown {
  const parsed = parsePossibleJson(value);

  if (Array.isArray(parsed)) {
    return parsed.flatMap((item) => normalizeCitationEntry(item));
  }

  if (parsed && typeof parsed === "object") {
    const direct = normalizeCitationEntry(parsed);
    if (direct.length) return direct;

    return Object.entries(parsed as Record<string, unknown>).flatMap(([key, item]) => {
      if (typeof item === "string") {
        return [{ marker: key, claim: item }];
      }

      if (item && typeof item === "object") {
        return [{ ...(item as Record<string, unknown>), marker: (item as Record<string, unknown>).marker ?? key }];
      }

      return [];
    });
  }

  return [];
}

function normalizeCitationEntry(value: unknown): Array<{ marker?: unknown; claim?: unknown }> {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const marker =
    record.marker ??
    record.source ??
    record.sourceMarker ??
    record.citation ??
    record.ref ??
    record.reference ??
    record.id;
  const claim =
    record.claim ??
    record.evidence ??
    record.quote ??
    record.text ??
    record.support ??
    record.reason;

  if (marker === undefined && claim === undefined) return [];
  return [{ marker, claim }];
}

function normalizeCitationMarker(value: unknown): unknown {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `S${Math.trunc(value)}`;
  }

  if (typeof value !== "string") return value;

  const normalized = value.trim();
  const markerMatch = normalized.match(/s\s*(\d+)/i);
  if (markerMatch?.[1]) return `S${Number(markerMatch[1])}`;

  const numericMatch = normalized.match(/^\[?\s*(\d+)\s*\]?$/);
  if (numericMatch?.[1]) return `S${Number(numericMatch[1])}`;

  return normalized.toUpperCase();
}

function normalizeCitationClaim(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join("; ");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["claim", "evidence", "quote", "text", "summary"]) {
      if (typeof record[key] === "string") return record[key].trim();
    }
  }
  return value;
}

function parsePossibleJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
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

  if (
    includesAny(normalized, [
      "attachment",
      "attachments",
      "file",
      "pdf",
      "document",
      "upload",
      "uploaded",
      "tệp",
      "tep",
      "file đính kèm",
      "file dinh kem",
      "đính kèm",
      "dinh kem",
      "tai lieu",
      "tài liệu",
    ])
  ) {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["attachment"],
      preferredChunkTypes: ["general_note", "general"],
      vectorWeight: 0.62,
      lexicalWeight: 0.38,
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

  if (hasRecentIntent(normalizedQuestion)) {
    return dateRange(addDays(today, -30), addDays(today, 1));
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
    "khong co thong tin",
    "khong co du lieu",
    "chua co thong tin",
    "chua co du lieu",
    "khong co thong tin cu the",
    "khong co du thong tin",
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

  if (isModelValidationErrorMessage(message)) {
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

function isModelValidationErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid json") ||
    normalized.includes("could not be repaired") ||
    normalized.includes("validation") ||
    normalized.includes("zoderror")
  );
}

function summarizeError(message: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("invalid json") ||
    normalized.includes("could not be repaired")
  ) {
    return "Generated answer JSON was invalid and could not be parsed safely.";
  }

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
    answerMode: "no_memory",
  };
}
