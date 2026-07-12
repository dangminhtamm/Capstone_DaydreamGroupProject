// Indexes generated summaries as first-class memory sources.

import { insertMemoryChunks } from "@second-brain/db";
import {
  createDefaultEmbeddingProvider,
  type AdvancedEmbeddingProvider,
} from "./embedding.ts";
import type { PersistedMemoryChunkPayload } from "./memory-indexer.ts";
import type { MemoryChunkMetadata } from "./types.ts";

export interface IndexMemoryFromSummaryInput {
  userId: string;
  summaryId: string;
  summaryType: string;
  content: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  embeddingProvider?: Pick<AdvancedEmbeddingProvider, "embedDocument">;
  insertChunks?: (chunks: PersistedMemoryChunkPayload[]) => Promise<unknown>;
}

export interface IndexMemoryFromSummaryResult {
  sourceType: "summary";
  sourceId: string;
  chunkCount: number;
}

const MAX_SUMMARY_CHUNK_CHARS = 1200;

export async function indexMemoryFromSummary(
  input: IndexMemoryFromSummaryInput,
): Promise<IndexMemoryFromSummaryResult> {
  const content = input.content.replace(/\s+/g, " ").trim();

  if (!content) {
    return {
      sourceType: "summary",
      sourceId: input.summaryId,
      chunkCount: 0,
    };
  }

  const periodStart = normalizeDate(input.periodStart);
  const periodEnd = normalizeDate(input.periodEnd);
  const embeddingProvider =
    input.embeddingProvider ?? createDefaultEmbeddingProvider();
  const persistedChunks: PersistedMemoryChunkPayload[] = [];

  for (const [index, text] of splitSummaryText(content).entries()) {
    const metadata: MemoryChunkMetadata = {
      date: periodStart.toISOString(),
      sourceType: "summary",
      sourceId: input.summaryId,
      sourceTitle: `${input.summaryType} summary`,
      chunkIndex: index,
      chunkType: "reflection",
      tags: ["summary", input.summaryType],
      people: [],
      projects: [],
      goals: [],
      habits: [],
      importance: 4,
    };

    persistedChunks.push({
      userId: input.userId,
      sourceType: "summary",
      sourceId: input.summaryId,
      chunkIndex: index,
      chunkType: "reflection",
      text,
      evidence: text.slice(0, 500),
      metadata: {
        ...metadata,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        summaryType: input.summaryType,
      } as MemoryChunkMetadata,
      occurredAt: periodStart,
      embedding: await embeddingProvider.embedDocument(text),
    });
  }

  await (input.insertChunks ?? insertMemoryChunks)(persistedChunks);

  return {
    sourceType: "summary",
    sourceId: input.summaryId,
    chunkCount: persistedChunks.length,
  };
}

function splitSummaryText(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_SUMMARY_CHUNK_CHARS) {
    const splitAt = findSplitPoint(remaining);
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

function findSplitPoint(text: string): number {
  const window = text.slice(0, MAX_SUMMARY_CHUNK_CHARS);
  const paragraphBreak = window.lastIndexOf("\n");
  if (paragraphBreak >= MAX_SUMMARY_CHUNK_CHARS * 0.55) return paragraphBreak;

  const sentenceBreak = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );
  if (sentenceBreak >= MAX_SUMMARY_CHUNK_CHARS * 0.55) return sentenceBreak + 1;

  const wordBreak = window.lastIndexOf(" ");
  return wordBreak >= MAX_SUMMARY_CHUNK_CHARS * 0.55
    ? wordBreak
    : MAX_SUMMARY_CHUNK_CHARS;
}

function normalizeDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return new Date();
  return date;
}
