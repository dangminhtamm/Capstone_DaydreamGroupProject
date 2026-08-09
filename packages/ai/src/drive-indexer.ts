import { insertMemoryChunks } from "@second-brain/db";
import {
  createDefaultEmbeddingProvider,
  type AdvancedEmbeddingProvider,
} from "./embedding.ts";
import {
  normalizeWhitespace,
  splitTextByBoundary,
  withEmbeddings,
} from "./indexing-utils.ts";
import type { PersistedMemoryChunkPayload } from "./memory-indexer.ts";
import { withMemoryDate, type MemoryChunkMetadata } from "./types.ts";

export interface IndexMemoryFromDriveInput {
  userId: string;
  driveFileId: string;
  externalId: string;
  name: string;
  mimeType: string;
  extractedText: string;
  webViewLink?: string | null;
  modifiedTime?: Date | null;
  embeddingProvider?: Pick<AdvancedEmbeddingProvider, "embedDocument">;
  insertChunks?: (chunks: PersistedMemoryChunkPayload[]) => Promise<unknown>;
}

export interface IndexMemoryFromDriveResult {
  sourceType: "drive";
  fileId: string;
  chunkCount: number;
}

export async function indexMemoryFromDrive(
  input: IndexMemoryFromDriveInput,
): Promise<IndexMemoryFromDriveResult> {
  const cleanText = normalizeWhitespace(input.extractedText);
  if (!cleanText) {
    return {
      sourceType: "drive",
      fileId: input.driveFileId,
      chunkCount: 0,
    };
  }

  const embeddingProvider =
    input.embeddingProvider ?? createDefaultEmbeddingProvider();
  const doInsert = input.insertChunks ?? insertMemoryChunks;
  const occurredAt = input.modifiedTime ?? new Date();
  const parts = splitTextByBoundary(cleanText, 1200);

  const chunks = parts.map((text, index) => {
    const metadata: MemoryChunkMetadata = withMemoryDate({
      date: occurredAt.toISOString(),
      sourceType: "drive",
      sourceId: input.driveFileId,
      sourceTitle: input.name,
      sourceUrl: input.webViewLink ?? undefined,
      chunkIndex: index,
      chunkType: "general_note",
      fileType: input.mimeType,
      tags: ["google", "drive"],
      people: [],
      projects: [],
      importance: 3,
    });

    return {
      userId: input.userId,
      sourceType: "drive",
      sourceId: input.driveFileId,
      chunkIndex: index,
      chunkType: "general_note",
      text,
      evidence: text.slice(0, 400),
      metadata,
      occurredAt,
    } satisfies Omit<PersistedMemoryChunkPayload, "embedding">;
  });

  const persistedChunks = await withEmbeddings(chunks, embeddingProvider);
  await doInsert(persistedChunks);

  return {
    sourceType: "drive",
    fileId: input.driveFileId,
    chunkCount: persistedChunks.length,
  };
}
