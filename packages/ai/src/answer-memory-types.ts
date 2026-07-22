import type { MemoryCitation } from "./answer-utils.ts";
import type { RetrievalFilters } from "./retrieval.ts";

export type AnswerMode =
  | "cache"
  | "fast_path"
  | "gemini"
  | "extractive_fallback"
  | "no_memory";

export type ResponseLanguage = "en" | "vi";
export type AnswerStrategy = "auto" | "fast" | "deep";

export type MemoryIntent =
  | "feedback"
  | "blocker"
  | "latency"
  | "gmail"
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

export interface AnswerMemoryOptions {
  filters?: RetrievalFilters;
  limit?: number;
  maxDistance?: number;
  minTopSimilarity?: number;
  responseLanguage?: ResponseLanguage;
  answerStrategy?: AnswerStrategy;
}
