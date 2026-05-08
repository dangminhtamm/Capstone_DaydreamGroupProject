import { insertMemoryChunks } from "@second-brain/db";
import { generateSemanticChunks } from "./chunker.ts";
import {
  createDefaultEmbeddingProvider,
  type AdvancedEmbeddingProvider,
} from "./embedding.ts";
import type { MemoryChunkMetadata } from "./types.ts";

export interface PersistedMemoryChunkPayload {
  userId: string;
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  chunkType: string;
  text: string;
  evidence: string | null;
  metadata: MemoryChunkMetadata;
  occurredAt: Date;
  embedding: number[];
}

export interface IndexedMemoryChunk {
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  chunkType: string;
  text: string;
  evidence: string | null;
  metadata: MemoryChunkMetadata;
  occurredAt: string;
  embeddingDimension: number;
}

export interface IndexMemoryFromDiaryInput {
  userId: string;
  diaryId: string;
  rawText: string;
  entryDate?: Date | string | null;
  sourceTitle?: string;
  embeddingProvider?: Pick<AdvancedEmbeddingProvider, "embedDocument">;
  insertChunks?: (chunks: PersistedMemoryChunkPayload[]) => Promise<unknown>;
}

export interface IndexMemoryFromDiaryResult {
  sourceType: "diary";
  sourceId: string;
  chunkCount: number;
  chunks: IndexedMemoryChunk[];
}

export async function indexMemoryFromDiary(
  input: IndexMemoryFromDiaryInput,
): Promise<IndexMemoryFromDiaryResult> {
  const rawText = input.rawText.trim();

  if (!rawText) {
    return {
      sourceType: "diary",
      sourceId: input.diaryId,
      chunkCount: 0,
      chunks: [],
    };
  }

  const date = normalizeDate(input.entryDate);
  const semanticChunks = await generateSemanticChunks(rawText, {
    sourceType: "diary",
    sourceId: input.diaryId,
    date,
    sourceTitle: input.sourceTitle,
  });

  if (!semanticChunks.length) {
    return {
      sourceType: "diary",
      sourceId: input.diaryId,
      chunkCount: 0,
      chunks: [],
    };
  }

  const embeddingProvider =
    input.embeddingProvider ?? createDefaultEmbeddingProvider();
  const persistedChunks: PersistedMemoryChunkPayload[] = [];

  for (const chunk of semanticChunks) {
    persistedChunks.push({
      userId: input.userId,
      sourceType: chunk.metadata.sourceType,
      sourceId: chunk.metadata.sourceId,
      chunkIndex: chunk.metadata.chunkIndex,
      chunkType: chunk.metadata.chunkType,
      text: chunk.text,
      evidence: chunk.evidence ?? null,
      metadata: chunk.metadata,
      occurredAt: chunk.metadata.date ? new Date(chunk.metadata.date) : new Date(),
      embedding: await embeddingProvider.embedDocument(chunk.text),
    });
  }

  await (input.insertChunks ?? insertMemoryChunks)(persistedChunks);

  return {
    sourceType: "diary",
    sourceId: input.diaryId,
    chunkCount: persistedChunks.length,
    chunks: persistedChunks.map((chunk) => ({
      sourceType: chunk.sourceType,
      sourceId: chunk.sourceId,
      chunkIndex: chunk.chunkIndex,
      chunkType: chunk.chunkType,
      text: chunk.text,
      evidence: chunk.evidence,
      metadata: chunk.metadata,
      occurredAt: chunk.occurredAt.toISOString(),
      embeddingDimension: chunk.embedding.length,
    })),
  };
}

function normalizeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid diary entry date: "${value}"`);
  }
  return date.toISOString();
}
