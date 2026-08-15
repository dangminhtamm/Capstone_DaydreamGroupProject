// packages/ai/src/answer-memory-stream.ts
//
// Experimental compatibility wrapper for future streaming transports.
// It intentionally delegates to `answerMemory` before opening the stream so
// streaming consumers cannot bypass JSON validation, citation recovery,
// fallback handling, analytics, or debug traces from the production pipeline.

import { answerMemory } from "./answer-memory.ts";
import type { MemoryCitation } from "./answer-utils.ts";
import type {
  AnswerMemoryOptions,
  AnswerMemoryResult,
  AnswerMode,
  MemoryDebugTrace,
  QueryAnalytics,
} from "./answer-memory-types.ts";
import type { MemoryDbClient } from "./types.ts";

const FALLBACK_STREAM_CHUNK_CHARS = 96;
const DEFAULT_STREAM_CHUNK_CHARS = sanitizeStreamChunkChars(
  Number(process.env.MEMORY_STREAM_CHUNK_CHARS ?? FALLBACK_STREAM_CHUNK_CHARS),
);

export interface AnswerMemoryStreamOptions extends AnswerMemoryOptions {
  /**
   * Controls how the already-validated answer is split for transport.
   * This is not model token streaming; it is a safe stream over the canonical
   * answerMemory result.
   */
  streamChunkChars?: number;
}

export interface AnswerMemoryStreamResult {
  stream: ReadableStream<string>;
  answer: string;
  citations: MemoryCitation[];
  confidence: "high" | "medium" | "low";
  noMemory: boolean;
  suggestions: string[];
  answerMode: AnswerMode;
  analytics?: QueryAnalytics;
  debugTrace?: MemoryDebugTrace;
  modelError?: AnswerMemoryResult["modelError"];
}

/**
 * Safe streaming-shaped variant of `answerMemory`.
 *
 * This function waits for the canonical grounded-answer pipeline to finish,
 * then streams the validated answer text in small chunks. API/UI should keep
 * treating real token-by-token Tuturuuu streaming as experimental until the
 * final streamed output can be validated and citation-recovered before display.
 */
export async function answerMemoryStream(
  question: string,
  userId: string,
  dbClient: MemoryDbClient,
  options: AnswerMemoryStreamOptions = {},
): Promise<AnswerMemoryStreamResult> {
  const { streamChunkChars, ...answerOptions } = options;
  const result = await answerMemory(question, userId, dbClient, answerOptions);

  return {
    stream: textToStream(
      result.answer,
      sanitizeStreamChunkChars(streamChunkChars ?? DEFAULT_STREAM_CHUNK_CHARS),
    ),
    answer: result.answer,
    citations: result.citations,
    confidence: result.confidence,
    noMemory: result.noMemory ?? false,
    suggestions: result.suggestions ?? [],
    answerMode: result.answerMode,
    analytics: result.analytics,
    debugTrace: result.debugTrace,
    modelError: result.modelError,
  };
}

function sanitizeStreamChunkChars(value: number): number {
  if (!Number.isFinite(value)) return FALLBACK_STREAM_CHUNK_CHARS;
  return Math.min(512, Math.max(16, Math.floor(value)));
}

function textToStream(text: string, chunkChars: number): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (let index = 0; index < text.length; index += chunkChars) {
        controller.enqueue(text.slice(index, index + chunkChars));
      }
      controller.close();
    },
  });
}
