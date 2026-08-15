import { buildCitations } from "./answer-utils.ts";
import type {
  AnswerMode,
  AnswerMemoryResult,
  MemoryIndexDiagnostics,
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

  if (status === 401 || message.includes("401") || message.toLowerCase().includes("invalid_api_key")) {
    return { status: status ?? 401, kind: "auth", message: summarizeError(message) };
  }

  if (status === 429 || message.includes("429")) {
    return { status: status ?? 429, kind: "quota", message: summarizeError(message) };
  }

  if (isTuturuuuBillingError(message)) {
    return { status, kind: "billing", message: summarizeError(message) };
  }

  if (status === 404 || isModelConfigError(message)) {
    return { status: status ?? 404, kind: "model_config", message: summarizeError(message) };
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

  if (isTuturuuuGatewayNetworkError(message)) {
    return { status, kind: "service_unavailable", message: summarizeError(message) };
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
  diagnostics?: MemoryIndexDiagnostics;
  routingTrace?: MemoryDebugTrace["routingTrace"];
}): MemoryDebugTrace {
  const chunkById = new Map(input.chunks.map((chunk) => [chunk.id, chunk]));

  return {
    question: input.question,
    inferredFilters: serializeFilters(input.inferredFilters),
    appliedFilters: serializeFilters(input.appliedFilters),
    status: input.result.analytics?.status ?? "error",
    reason: explainResult(input.result, input.chunks, input.diagnostics),
    routingTrace: input.routingTrace,
    chunksRetrieved: input.chunks.length,
    diagnostics: input.diagnostics,
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
        entityScore: roundScore(chunkById.get(citation.chunkId)?.entityScore ?? 0),
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

function isTuturuuuGatewayNetworkError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("ai gateway network/tls") ||
    normalized.includes("self-signed certificate") ||
    normalized.includes("certificate chain") ||
    normalized.includes("node_extra_ca_certs")
  );
}

function isModelConfigError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("model_not_found") ||
    normalized.includes("model is not enabled") ||
    normalized.includes("model not found") ||
    normalized.includes("models/") && normalized.includes("not found")
  );
}

function isTuturuuuBillingError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("usage could not be settled") ||
    normalized.includes("billing") ||
    normalized.includes("metering")
  );
}

function summarizeError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid_api_key") || normalized.includes("supplied api key is invalid")) {
    return "Tuturuuu AI API key is invalid or revoked. Create a valid metered API key and set TUTURUUU_AI_API_KEY.";
  }

  if (isTuturuuuGatewayNetworkError(message)) {
    return "Tuturuuu AI gateway TLS/certificate is not trusted by Node.js. Use a valid gateway certificate or configure NODE_EXTRA_CA_CERTS.";
  }

  if (isTuturuuuBillingError(message)) {
    return "Tuturuuu AI usage could not be settled for this workspace. Check Tuturuuu workspace billing/credits, or use google/gemini-3.5-flash-lite.";
  }

  if (isModelConfigError(message)) {
    return "Tuturuuu model is not enabled for this workspace. Use google/gemini-3.5-flash-lite for answers and google/gemini-embedding-2 for embeddings.";
  }

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
      return "Tuturuuu response hit the max output token limit before completing valid JSON.";
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

function explainResult(
  result: AnswerMemoryResult,
  chunks: MemorySearchHit[],
  diagnostics?: MemoryIndexDiagnostics,
): string {
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

    if (result.answerMode === "tuturuuu") {
      return "Answer generated by Tuturuuu AI with supported citations.";
    }

    return "Memory search completed successfully.";
  }

  if (!chunks.length) {
    if (diagnostics?.issue === "empty_index") {
      return "No memory chunks exist for the applied filters. Add/index diary, attachment, calendar, summary, or Gmail data first.";
    }

    if (diagnostics?.issue === "missing_embeddings") {
      return `Memory chunks exist for the filters, but none have embeddings. Drain indexing jobs or re-embed with ${diagnostics.embeddingModel}.`;
    }

    if (diagnostics?.issue === "stale_embeddings") {
      return `Memory chunks exist for the filters, but their stored embeddings are from an older or unknown model. Re-embed them with ${diagnostics.embeddingModel}.`;
    }

    if (diagnostics?.issue === "mixed_embeddings") {
      return `Some memory chunks use older embeddings; retrieval may miss relevant memories until all chunks are re-embedded with ${diagnostics.embeddingModel}.`;
    }

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
