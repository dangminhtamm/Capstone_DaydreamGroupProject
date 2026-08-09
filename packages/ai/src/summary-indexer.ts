// Indexes generated summaries as first-class memory sources.

import { insertMemoryChunks } from "@second-brain/db";
import {
  createDefaultEmbeddingProvider,
  type AdvancedEmbeddingProvider,
} from "./embedding.ts";
import {
  coerceDate,
  normalizeWhitespace,
  splitTextByBoundary,
  withEmbeddings,
} from "./indexing-utils.ts";
import type { PersistedMemoryChunkPayload } from "./memory-indexer.ts";
import { withMemoryDate, type MemoryChunkMetadata } from "./types.ts";

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

export async function indexMemoryFromSummary(
  input: IndexMemoryFromSummaryInput,
): Promise<IndexMemoryFromSummaryResult> {
  const content = normalizeWhitespace(input.content);

  if (!content) {
    return {
      sourceType: "summary",
      sourceId: input.summaryId,
      chunkCount: 0,
    };
  }

  const periodStart = coerceDate(input.periodStart);
  const periodEnd = coerceDate(input.periodEnd);
  const embeddingProvider =
    input.embeddingProvider ?? createDefaultEmbeddingProvider();

  const chunkPayloads = splitTextByBoundary(content).map((text, index) => {
    const metadata: MemoryChunkMetadata = withMemoryDate({
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
    });

    return {
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
    } satisfies Omit<PersistedMemoryChunkPayload, "embedding">;
  });
  const persistedChunks: PersistedMemoryChunkPayload[] = await withEmbeddings(
    chunkPayloads,
    embeddingProvider,
  );

  await (input.insertChunks ?? insertMemoryChunks)(persistedChunks);

  return {
    sourceType: "summary",
    sourceId: input.summaryId,
    chunkCount: persistedChunks.length,
  };
}
