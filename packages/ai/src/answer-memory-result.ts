import { buildCitations } from "./answer-utils.ts";
import type {
  AnswerMode,
  AnswerMemoryResult,
  MemoryDebugTrace,
  QueryAnalytics,
  ResponseLanguage,
} from "./answer-memory-types.ts";
import type { MemorySearchHit, RetrievalFilters } from "./retrieval.ts";

export function classifyModelError(
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

export function buildDebugTrace(input: {
  question: string;
  inferredFilters: RetrievalFilters;
  appliedFilters: RetrievalFilters;
  chunks: MemorySearchHit[];
  result: AnswerMemoryResult;
}): MemoryDebugTrace {
  const chunkById = new Map(input.chunks.map((chunk) => [chunk.id, chunk]));

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
        distance: chunkById.get(citation.chunkId)?.distance ?? null,
        quote: citation.quote,
      })),
  };
}

export function buildQueryAnalytics(input: {
  model: string;
  chunksRetrieved: number;
  status: QueryAnalytics["status"];
  answerMode: AnswerMode;
  tokenUsage?: QueryAnalytics["tokenUsage"];
  timing?: Partial<QueryAnalytics["timing"]>;
}): QueryAnalytics {
  return {
    tokenUsage: input.tokenUsage ?? {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      model: input.model,
    },
    timing: {
      embedMs: 0,
      retrieveMs: 0,
      generateMs: 0,
      totalMs: 0,
      ...input.timing,
    },
    chunksRetrieved: input.chunksRetrieved,
    status: input.status,
    answerMode: input.answerMode,
  };
}

export function noMemoryResult(message: string, lang: ResponseLanguage): AnswerMemoryResult {
  const suggestions = lang === "vi"
    ? [
        "Thêm nhật ký mới về chủ đề này",
        "Thử diễn đạt lại câu hỏi",
        "Đồng bộ Google Calendar để thêm ký ức",
      ]
    : [
        "Add a new diary entry about this topic",
        "Try rephrasing your question",
        "Sync your Google Calendar for more memories",
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

function isModelValidationErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid json") ||
    normalized.includes("could not be repaired") ||
    normalized.includes("truncated") ||
    normalized.includes("finishreason") ||
    normalized.includes("did not finish normally") ||
    normalized.includes("validation") ||
    normalized.includes("zoderror")
  );
}

function summarizeError(message: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("invalid json") ||
    normalized.includes("could not be repaired") ||
    normalized.includes("truncated") ||
    normalized.includes("max_tokens") ||
    normalized.includes("finishreason=max_tokens") ||
    normalized.includes("invalid_type") ||
    normalized.includes("nonoptional") ||
    normalized.includes("received undefined") ||
    normalized.includes("expected nonoptional")
  ) {
    if (
      normalized.includes("truncated") ||
      normalized.includes("max_tokens") ||
      normalized.includes("finishreason=max_tokens")
    ) {
      return "Gemini response hit the max output token limit before completing valid JSON.";
    }
    return "Generated answer JSON was invalid and could not be parsed safely.";
  }

  return message.replace(/\s+/g, " ").slice(0, 240);
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
    if (result.answerMode === "extractive_fallback") {
      return result.modelError
        ? `Extractive fallback used after ${result.modelError.kind}: ${result.modelError.message}`
        : "Answer assembled directly from retrieved memories.";
    }

    if (
      result.answerMode === "fast_path" ||
      result.analytics.tokenUsage.model === "fast-path" ||
      result.analytics.tokenUsage.model === "temporal-fast-path"
    ) {
      if (result.analytics.tokenUsage.totalTokens > 0) {
        return "Fast answer assembled from retrieved chunks, then translated or polished with a small model call.";
      }
      return "Answer assembled from retrieved chunks without model generation.";
    }

    if (result.answerMode === "gemini") {
      return "Answer generated with supported citations.";
    }

    return "Memory search completed successfully.";
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
