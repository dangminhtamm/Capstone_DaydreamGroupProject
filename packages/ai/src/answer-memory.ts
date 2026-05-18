import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import { generateGeminiJson } from "./gemini-json.ts";
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

export interface AnswerMemoryResult {
  answer: string;
  confidence: "high" | "medium" | "low";
  citations: MemoryCitation[];
  modelError?: {
    status?: number;
    kind: "quota" | "service_unavailable" | "validation" | "transient" | "unknown";
    message: string;
  };
}

export interface AnswerMemoryOptions {
  filters?: RetrievalFilters;
  limit?: number;
  maxDistance?: number;
  minTopSimilarity?: number;
}

export async function answerMemory(
  question: string,
  userId: string,
  dbClient: MemoryDbClient,
  options: AnswerMemoryOptions = {},
): Promise<AnswerMemoryResult> {
  const normalizedQuestion = question.trim();

  if (!normalizedQuestion) {
    return lowConfidenceNoAnswer("Bạn chưa nhập câu hỏi.");
  }

  const inferredFilters = inferRetrievalFilters(normalizedQuestion);
  const chunks = await retrieveMemory(normalizedQuestion, userId, dbClient, {
    ...inferredFilters,
    ...options.filters,
    limit: options.limit ?? 8,
    maxDistance: options.maxDistance ?? DEFAULT_MAX_DISTANCE,
  });

  return answerFromChunks(normalizedQuestion, chunks, {
    minTopSimilarity: options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
  });
}

export async function answerFromChunks(
  question: string,
  chunks: MemorySearchHit[],
  options: { minTopSimilarity?: number } = {},
): Promise<AnswerMemoryResult> {
  const minTopSimilarity = options.minTopSimilarity ?? MIN_TOP_SIMILARITY;

  if (!chunks.length) {
    return lowConfidenceNoAnswer(
      "Mình chưa tìm thấy ký ức đủ liên quan để trả lời chắc chắn.",
    );
  }

  const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);
  const topSimilarity = sortedChunks[0]?.similarity ?? 0;

  if (topSimilarity < minTopSimilarity) {
    return {
      answer:
        "Mình tìm thấy một vài ký ức gần nghĩa, nhưng độ liên quan chưa đủ cao để trả lời chắc chắn.",
      confidence: "low",
      citations: [],
    };
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
- Keep the answer in the same language as the user question.
`.trim();

  try {
    const output = await generateGeminiJson({
      model: process.env.GEMINI_ANSWER_MODEL ?? "gemini-2.5-flash",
      prompt,
      responseSchema: GeminiGroundedAnswerResponseSchema,
      validator: GroundedAnswerSchema,
      temperature: 0.1,
      maxOutputTokens: Number(process.env.MEMORY_MAX_ANSWER_TOKENS ?? 1024),
    });

    const allowedMarkers = new Set(sources.map((source) => source.marker));
    const validModelCitations = output.citations.filter((citation) =>
      allowedMarkers.has(citation.marker),
    );

    if (!validModelCitations.length) {
      return {
        answer:
          "Mình tìm thấy một số ký ức liên quan, nhưng câu trả lời sinh ra không có citation hợp lệ nên mình không thể xác nhận chắc chắn.",
        confidence: "low",
        citations: [],
      };
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
    };
  } catch (error) {
    const modelError = classifyModelError(error);
    console.warn(
      `[AnswerMemory] Failed to generate grounded answer (${modelError.kind}${modelError.status ? ` ${modelError.status}` : ""}): ${modelError.message}`,
    );

    return {
      answer:
        "Mình đã tìm thấy ký ức liên quan, nhưng không thể tạo câu trả lời có cấu trúc đáng tin cậy ở lần này.",
      confidence: "low",
      citations: [],
      modelError,
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

function lowConfidenceNoAnswer(message: string): AnswerMemoryResult {
  return {
    answer: message,
    confidence: "low",
    citations: [],
  };
}
