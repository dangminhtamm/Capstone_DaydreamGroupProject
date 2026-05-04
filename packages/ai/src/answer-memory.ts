// packages/ai/src/answer-memory.ts
import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { retrieveMemory, type MemorySearchHit, type RetrievalFilters } from "./retrieval.js";
import type { MemoryDbClient } from "./db-types.js";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MIN_TOP_SIMILARITY = Number(process.env.MEMORY_MIN_TOP_SIMILARITY ?? 0.65);
const DEFAULT_MAX_DISTANCE = Number(process.env.MEMORY_MAX_DISTANCE ?? 0.35);

const GroundedAnswerSchema = z.object({
  answer: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  citations: z.array(
    z.object({
      marker: z.string().regex(/^S\d+$/),
      claim: z.string().min(1).describe("The specific claim supported by this source"),
    }),
  ),
});

export interface MemoryCitation {
  marker: string;
  chunkId: string;
  sourceType: string;
  sourceId: string;
  sourceTitle?: string;
  occurredAt: string;
  chunkType: string;
  quote: string;
  similarity: number;
  claim?: string;
}

export interface AnswerMemoryResult {
  answer: string;
  confidence: "high" | "medium" | "low";
  citations: MemoryCitation[];
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

  const chunks = await retrieveMemory(normalizedQuestion, userId, dbClient, {
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
      citations: buildCitations(sortedChunks.slice(0, 3)),
    };
  }

  const sources = buildCitations(sortedChunks);
  const sourceContext = sources
    .map((source) => {
      return [
        `[${source.marker}]`,
        `date: ${source.occurredAt}`,
        `sourceType: ${source.sourceType}`,
        `sourceId: ${source.sourceId}`,
        `chunkType: ${source.chunkType}`,
        `similarity: ${source.similarity.toFixed(3)}`,
        `evidence: ${source.quote}`,
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
- Every concrete claim must be supported by a citation marker like [S1].
- Use only citation markers that appear in the retrieved memory sources.
- If the sources do not answer the question, say that the memory is insufficient and set confidence to "low".
- Prefer a concise answer over a fluent but unsupported answer.
- Keep the answer in the same language as the user question.
`.trim();

  try {
    const { output } = await generateText({
      model: google(process.env.GEMINI_ANSWER_MODEL ?? "gemini-2.5-flash"),
      prompt,
      output: Output.object({
        schema: GroundedAnswerSchema,
        name: "grounded_memory_answer",
        description:
          "A grounded answer using only retrieved memory sources and citation markers.",
      }),
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
        citations: sources.slice(0, 3),
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

    const retrievalConfidence = classifyRetrievalConfidence(topSimilarity, citations.length);
    const finalConfidence = minConfidence(output.confidence, retrievalConfidence);

    return {
      answer: ensureAnswerHasCitationMarkers(output.answer, citations),
      confidence: finalConfidence,
      citations,
    };
  } catch (error) {
    console.error("Failed to generate grounded memory answer:", error);

    return {
      answer:
        "Mình đã tìm thấy ký ức liên quan, nhưng không thể tạo câu trả lời có cấu trúc đáng tin cậy ở lần này.",
      confidence: "low",
      citations: sources.slice(0, 3),
    };
  }
}

function buildCitations(chunks: MemorySearchHit[]): MemoryCitation[] {
  return chunks.map((chunk, index) => {
    const metadata = safeMetadata(chunk.metadata);

    return {
      marker: `S${index + 1}`,
      chunkId: chunk.id,
      sourceType: chunk.sourceType,
      sourceId: chunk.sourceId,
      sourceTitle: metadata.sourceTitle,
      occurredAt: chunk.occurredAt instanceof Date
        ? chunk.occurredAt.toISOString()
        : new Date(chunk.occurredAt).toISOString(),
      chunkType: chunk.chunkType,
      quote: trimEvidence(chunk.evidence ?? chunk.text),
      similarity: Number(chunk.similarity),
    };
  });
}

function safeMetadata(metadata: unknown): { sourceTitle?: string } {
  if (!metadata || typeof metadata !== "object") return {};
  const value = metadata as Record<string, unknown>;

  return {
    sourceTitle:
      typeof value.sourceTitle === "string" ? value.sourceTitle : undefined,
  };
}

function trimEvidence(text: string, maxLength = 600): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function classifyRetrievalConfidence(
  topSimilarity: number,
  citationCount: number,
): "high" | "medium" | "low" {
  if (topSimilarity >= 0.8 && citationCount >= 2) return "high";
  if (topSimilarity >= 0.65 && citationCount >= 1) return "medium";
  return "low";
}

function minConfidence(
  modelConfidence: "high" | "medium" | "low",
  retrievalConfidence: "high" | "medium" | "low",
): "high" | "medium" | "low" {
  const rank = { low: 0, medium: 1, high: 2 } as const;
  return rank[modelConfidence] <= rank[retrievalConfidence]
    ? modelConfidence
    : retrievalConfidence;
}

function ensureAnswerHasCitationMarkers(
  answer: string,
  citations: MemoryCitation[],
): string {
  const hasMarker = /\[S\d+\]/.test(answer);
  if (hasMarker || citations.length === 0) return answer;

  const fallbackMarker = `[${citations[0].marker}]`;
  return `${answer.trim()} ${fallbackMarker}`;
}

function lowConfidenceNoAnswer(message: string): AnswerMemoryResult {
  return {
    answer: message,
    confidence: "low",
    citations: [],
  };
}