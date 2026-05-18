// packages/ai/src/answer-memory-stream.ts
//
// Streaming variant of answerMemory: retrieves memory chunks, then streams
// the grounded answer token-by-token via a ReadableStream, appending
// structured citation metadata at the end as a special SSE event.

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  retrieveMemory,
  type MemorySearchHit,
  type RetrievalFilters,
} from "./retrieval.ts";
import type { MemoryDbClient } from "./types.ts";
import {
  type MemoryCitation,
  buildCitations,
  classifyRetrievalConfidence,
} from "./answer-utils.ts";
import { inferRetrievalFilters } from "./answer-memory.ts";

const MIN_TOP_SIMILARITY = Number(
  process.env.MEMORY_MIN_TOP_SIMILARITY ?? 0.55,
);
const DEFAULT_MAX_DISTANCE = Number(process.env.MEMORY_MAX_DISTANCE ?? 0.5);
const MAX_ANSWER_TOKENS = Number(process.env.MEMORY_MAX_ANSWER_TOKENS ?? 512);

// Singleton Gemini client — avoids re-initialization overhead per request
let _geminiClient: GoogleGenerativeAI | null = null;
function getGeminiClient(): GoogleGenerativeAI {
  if (!_geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is required to call Gemini.");
    _geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return _geminiClient;
}

export interface AnswerMemoryStreamOptions {
  filters?: RetrievalFilters;
  limit?: number;
  maxDistance?: number;
  minTopSimilarity?: number;
}

/**
 * The streaming result object. Contains:
 * - `stream`: A ReadableStream<string> of answer text chunks
 * - `citations`: A promise that resolves to the citations array once retrieval is done
 * - `confidence`: A promise that resolves to the confidence level
 */
export interface AnswerMemoryStreamResult {
  stream: ReadableStream<string>;
  citations: MemoryCitation[];
  confidence: "high" | "medium" | "low";
  /** True if no relevant memory was found */
  noMemory: boolean;
}

/**
 * Stream-based variant of `answerMemory`.
 *
 * Phase 1 (synchronous, fast): Retrieve relevant memory chunks via hybrid search.
 * Phase 2 (streaming): Stream the grounded answer from Gemini token-by-token.
 *
 * The caller gets back the stream + citations immediately after Phase 1 completes.
 */
export async function answerMemoryStream(
  question: string,
  userId: string,
  dbClient: MemoryDbClient,
  options: AnswerMemoryStreamOptions = {},
): Promise<AnswerMemoryStreamResult> {
  const normalizedQuestion = question.trim();

  if (!normalizedQuestion) {
    return noMemoryResult("Bạn chưa nhập câu hỏi.");
  }

  // Phase 1: Retrieve memory chunks (this is the fast part, ≤500ms target)
  const chunks = await retrieveMemory(normalizedQuestion, userId, dbClient, {
    ...inferRetrievalFilters(normalizedQuestion),
    ...options.filters,
    limit: options.limit ?? 8,
    maxDistance: options.maxDistance ?? DEFAULT_MAX_DISTANCE,
  });

  const minTopSimilarity = options.minTopSimilarity ?? MIN_TOP_SIMILARITY;

  if (!chunks.length) {
    return noMemoryResult(
      "Mình chưa tìm thấy ký ức đủ liên quan để trả lời chắc chắn.",
    );
  }

  const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);
  const topSimilarity = sortedChunks[0]?.similarity ?? 0;

  if (topSimilarity < minTopSimilarity) {
    return {
      stream: textToStream(
        "Mình tìm thấy một vài ký ức gần nghĩa, nhưng độ liên quan chưa đủ cao để trả lời chắc chắn.",
      ),
      citations: [],
      confidence: "low",
      noMemory: false,
    };
  }

  // Build citation context for the prompt
  const citations = buildCitations(sortedChunks);
  // Only send the top 5 most relevant sources to the prompt to reduce input tokens
  const promptSources = citations.slice(0, 5);
  const sourceContext = promptSources
    .map((source) =>
      [
        `[${source.marker}]`,
        `date: ${source.occurredAt}`,
        `type: ${source.sourceType}/${source.chunkType}`,
        `memory: ${source.quote}`,
      ].join("\n"),
    )
    .join("\n\n");

  const prompt = `
You are the grounded answer generator for a personal Second Brain memory system.

Question:
${normalizedQuestion}

Retrieved memory sources:
${sourceContext}

Rules:
- Answer ONLY using the retrieved memory sources.
- Do not invent dates, people, events, decisions, emotions, or outcomes.
- Answer naturally without adding any citation markers (like [S1]) in your text.
- If the sources do not answer the question, say that the memory is insufficient.
- Prefer a concise answer over a fluent but unsupported answer.
- Keep the answer in the same language as the user question.
`.trim();

  // Phase 2: Stream the answer from Gemini
  const ai = getGeminiClient();
  const model = ai.getGenerativeModel({
    model: process.env.GEMINI_ANSWER_MODEL ?? "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: MAX_ANSWER_TOKENS,
    },
  });

  let geminiStream;
  try {
    geminiStream = await model.generateContentStream(prompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[AnswerMemoryStream] Failed to start Gemini stream: ${message.replace(/\s+/g, " ").slice(0, 240)}`,
    );

    return {
      stream: textToStream(
        "Mình đã tìm thấy ký ức liên quan, nhưng chưa thể tạo câu trả lời streaming ở lần này.",
      ),
      citations: [],
      confidence: "low",
      noMemory: false,
    };
  }

  // Convert Gemini's async iterator into a ReadableStream<string>
  const stream = new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const chunk of geminiStream.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(text);
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  const confidence = classifyRetrievalConfidence(
    topSimilarity,
    citations.length,
  );

  return {
    stream,
    citations,
    confidence,
    noMemory: false,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noMemoryResult(message: string): AnswerMemoryStreamResult {
  return {
    stream: textToStream(message),
    citations: [],
    confidence: "low",
    noMemory: true,
  };
}

function textToStream(text: string): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(text);
      controller.close();
    },
  });
}
