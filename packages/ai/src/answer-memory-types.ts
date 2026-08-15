import type { MemoryCitation } from "./answer-utils.ts";
import type { RetrievalFilters } from "./retrieval.ts";
import type { generateTuturuuuJsonWithMeta } from "./tuturuuu-json.ts";
import type { GroundedAnswer } from "./answer-memory-schema.ts";
import type { FastTranslationGenerator } from "./answer-memory-translation.ts";

export type AnswerMode =
  | "cache"
  | "fast_path"
  | "tuturuuu"
  | "extractive_fallback"
  | "no_memory";

export type ResponseLanguage = "en" | "vi";
export type AnswerStrategy = "auto" | "fast" | "deep";

export type MemoryIntent =
  | "feedback"
  | "blocker"
  | "latency"
  | "gmail"
  | "drive"
  | "google_contacts"
  | "mood"
  | "calendar"
  | "attachment"
  | "decision"
  | "task"
  | "progress"
  | "generic";

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
  cacheVersion?: string;
}

export interface MemoryIndexDiagnostics {
  embeddingModel: string;
  totalChunks: number;
  embeddedChunks: number;
  currentEmbeddingModelChunks: number;
  staleEmbeddingModelChunks: number;
  latestOccurredAt?: string | null;
  issue: "none" | "empty_index" | "missing_embeddings" | "stale_embeddings" | "mixed_embeddings";
}

export interface MemoryDebugTrace {
  question: string;
  inferredFilters: Record<string, unknown>;
  appliedFilters: Record<string, unknown>;
  status: "success" | "no_memory" | "error";
  reason: string;
  routingTrace?: {
    intent: MemoryIntent;
    requestedStrategy: AnswerStrategy;
    selectedPath:
      | "unindexed_fast_path"
      | "embedding_error_fallback"
      | "created_date_mismatch"
      | "indexed_fast_path"
      | "deep_generation"
      | "deep_validation_fallback"
      | "deep_model_error_fallback"
      | "no_memory";
    reason: string;
    autoFastEligible: boolean;
    fastPathEligible: boolean;
    usedUnindexedDiary: boolean;
    translationRan: boolean;
  };
  chunksRetrieved: number;
  diagnostics?: MemoryIndexDiagnostics;
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
    entityScore: number;
    distance: number | null;
    quote: string;
  }>;
}

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
    kind: "auth" | "quota" | "billing" | "model_config" | "service_unavailable" | "validation" | "transient" | "unknown";
    message: string;
  };
}

export interface AnswerMemoryOptions {
  filters?: RetrievalFilters;
  limit?: number;
  maxDistance?: number;
  minTopSimilarity?: number;
  now?: Date;
  responseLanguage?: ResponseLanguage;
  answerStrategy?: AnswerStrategy;
  timeZone?: string;
  embeddingProvider?: {
    embedQuery(text: string): Promise<number[]>;
  };
  generateAnswer?: typeof generateTuturuuuJsonWithMeta<GroundedAnswer>;
  generateTranslation?: FastTranslationGenerator;
}
