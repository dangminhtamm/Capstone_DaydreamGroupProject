// packages/ai/src/attachment-indexer.ts
//
// Indexes extracted attachment text as its own memory source. Attachments are
// linked back to a diary entry through metadata, but must not be persisted as
// diary chunks because that can overwrite the diary's source chunks.

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

export interface IndexMemoryFromAttachmentInput {
  userId: string;
  attachmentId: string;
  extractedText: string;
  diaryEntryId?: string;
  occurredAt?: Date | string | null;
  sourceTitle?: string;
  fileType?: string;
  sourceUrl?: string;
  embeddingProvider?: Pick<AdvancedEmbeddingProvider, "embedDocument">;
  insertChunks?: (chunks: PersistedMemoryChunkPayload[]) => Promise<unknown>;
}

export interface IndexMemoryFromAttachmentResult {
  sourceType: "attachment";
  sourceId: string;
  chunkCount: number;
  chunks: Array<{
    sourceType: "attachment";
    sourceId: string;
    chunkIndex: number;
    chunkType: "general_note";
    text: string;
    evidence: string;
    occurredAt: string;
    embeddingDimension: number;
  }>;
}

export async function indexMemoryFromAttachment(
  input: IndexMemoryFromAttachmentInput,
): Promise<IndexMemoryFromAttachmentResult> {
  const normalizedText = normalizeWhitespace(input.extractedText);

  if (!normalizedText) {
    return {
      sourceType: "attachment",
      sourceId: input.attachmentId,
      chunkCount: 0,
      chunks: [],
    };
  }

  const occurredAt = coerceDate(input.occurredAt);
  const textChunks = splitTextByBoundary(normalizedText);
  const embeddingProvider =
    input.embeddingProvider ?? createDefaultEmbeddingProvider();

  const chunkPayloads = textChunks.map((text, index) => {
    const metadata: MemoryChunkMetadata = withMemoryDate({
      date: occurredAt.toISOString(),
      sourceType: "attachment",
      sourceId: input.attachmentId,
      sourceTitle: input.sourceTitle,
      sourceUrl: input.sourceUrl,
      chunkIndex: index,
      chunkType: "general_note",
      diaryEntryId: input.diaryEntryId,
      fileType: input.fileType,
      tags: ["attachment", ...(input.fileType ? [input.fileType] : [])],
      people: [],
      projects: [],
      goals: [],
      habits: [],
      importance: 3,
    });

    return {
      userId: input.userId,
      sourceType: "attachment",
      sourceId: input.attachmentId,
      chunkIndex: index,
      chunkType: "general_note",
      text,
      evidence: text.slice(0, 500),
      metadata,
      occurredAt,
    } satisfies Omit<PersistedMemoryChunkPayload, "embedding">;
  });
  const persistedChunks: PersistedMemoryChunkPayload[] = await withEmbeddings(
    chunkPayloads,
    embeddingProvider,
  );

  await (input.insertChunks ?? insertMemoryChunks)(persistedChunks);

  return {
    sourceType: "attachment",
    sourceId: input.attachmentId,
    chunkCount: persistedChunks.length,
    chunks: persistedChunks.map((chunk) => ({
      sourceType: "attachment",
      sourceId: chunk.sourceId,
      chunkIndex: chunk.chunkIndex,
      chunkType: "general_note",
      text: chunk.text,
      evidence: chunk.evidence ?? "",
      occurredAt: chunk.occurredAt.toISOString(),
      embeddingDimension: chunk.embedding?.length ?? 0,
    })),
  };
}
