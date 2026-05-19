import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import { generateGeminiJsonWithMeta, type GeminiTokenUsage } from "./gemini-json.ts";
import {
  retrieveMemory,
  type MemorySearchHit,
  type RetrievalFilters,
} from "./retrieval.ts";
import type { MemoryDbClient } from "./types.ts";

const MIN_TOP_SIMILARITY = Number(
  process.env.MEMORY_MIN_TOP_SIMILARITY ?? 0.55,
);
const DEFAULT_MAX_DISTANCE = Number(process.env.MEMORY_MAX_DISTANCE ?? 0.5);

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

// ── Result types ─────────────────────────────────────────────────────

export interface AnswerMemoryResult {
  answer: string;
  confidence: "high" | "medium" | "low";
  citations: MemoryCitation[];
  noMemory?: boolean;
  suggestions?: string[];
  analytics?: QueryAnalytics;
  tokenUsage?: { inputTokens: number; outputTokens: number; model: string };
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

  // ── Embed + Retrieve (timed together since retrieveMemory embeds internally) ──
  const retrieveStart = performance.now();
  const chunks = await retrieveMemory(normalizedQuestion, userId, dbClient, {
    ...inferredFilters,
    ...options.filters,
    limit: options.limit ?? 8,
    maxDistance: options.maxDistance ?? DEFAULT_MAX_DISTANCE,
  });
  const retrieveMs = performance.now() - retrieveStart;

  const result = await answerFromChunks(normalizedQuestion, chunks, {
    minTopSimilarity: options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
    responseLanguage: lang,
  });

  // Patch analytics timing: answerFromChunks already set generateMs,
  // but we need to fill in embed/retrieve timings and total.
  if (result.analytics) {
    // embed is included in retrieve for this code path
    result.analytics.timing.embedMs = 0;
    result.analytics.timing.retrieveMs = Math.round(retrieveMs);
    result.analytics.timing.totalMs = Math.round(performance.now() - totalStart);
  }

  return result;
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

  if (topSimilarity < minTopSimilarity) {
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

    if (!validModelCitations.length) {
      const result = noMemoryResult(
        lang === 'vi'
          ? 'Mình tìm thấy một số ký ức liên quan, nhưng câu trả lời sinh ra không có citation hợp lệ nên mình không thể xác nhận chắc chắn.'
          : 'I found some related memories, but the generated answer had no valid citations, so I cannot confirm it reliably.',
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

    const citedMarkerToClaim = new Map(
      validModelCitations.map((citation) => [citation.marker, citation.claim]),
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
): "high" | "medium" | "low" {
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

export function inferRetrievalFilters(question: string): RetrievalFilters {
  const normalized = normalizeForIntent(question);

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
      preferredSourceTypes: ["calendar"],
      preferredChunkTypes: ["event", "general"],
      vectorWeight: 0.6,
      lexicalWeight: 0.4,
    };
  }

  if (includesAny(normalized, ["feedback", "nhận xét", "nhan xet", "góp ý", "gop y"])) {
    return {
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
      preferredSourceTypes: ["diary"],
      preferredChunkTypes: ["action_item", "task_update", "general", "general_note"],
      vectorWeight: 0.65,
      lexicalWeight: 0.35,
    };
  }

  if (includesAny(normalized, ["decide", "decision", "agreed", "quyết định", "quyet dinh", "thống nhất", "thong nhat"])) {
    return {
      preferredSourceTypes: ["diary"],
      preferredChunkTypes: ["decision", "general", "general_note"],
      vectorWeight: 0.65,
      lexicalWeight: 0.35,
    };
  }

  return {};
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
