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
import type { PersistedMemoryChunkPayload } from "./memory-indexer.ts";
import type { MemoryChunkMetadata } from "./types.ts";

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

const MAX_ATTACHMENT_CHUNK_CHARS = 1200;

export async function indexMemoryFromAttachment(
  input: IndexMemoryFromAttachmentInput,
): Promise<IndexMemoryFromAttachmentResult> {
  const normalizedText = input.extractedText.replace(/\s+/g, " ").trim();

  if (!normalizedText) {
    return {
      sourceType: "attachment",
      sourceId: input.attachmentId,
      chunkCount: 0,
      chunks: [],
    };
  }

  const occurredAt = normalizeDate(input.occurredAt);
  const textChunks = splitAttachmentText(normalizedText);
  const embeddingProvider =
    input.embeddingProvider ?? createDefaultEmbeddingProvider();
  const persistedChunks: PersistedMemoryChunkPayload[] = [];

  for (const [index, text] of textChunks.entries()) {
    const metadata: MemoryChunkMetadata = {
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
    };

    persistedChunks.push({
      userId: input.userId,
      sourceType: "attachment",
      sourceId: input.attachmentId,
      chunkIndex: index,
      chunkType: "general_note",
      text,
      evidence: text.slice(0, 500),
      metadata,
      occurredAt,
      embedding: await embeddingProvider.embedDocument(text),
    });
  }

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
      embeddingDimension: chunk.embedding.length,
    })),
  };
}

function splitAttachmentText(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_ATTACHMENT_CHUNK_CHARS) {
    const splitAt = findSplitPoint(remaining);
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

function findSplitPoint(text: string): number {
  const window = text.slice(0, MAX_ATTACHMENT_CHUNK_CHARS);
  const sentenceBreak = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );

  if (sentenceBreak >= MAX_ATTACHMENT_CHUNK_CHARS * 0.55) {
    return sentenceBreak + 1;
  }

  const wordBreak = window.lastIndexOf(" ");
  return wordBreak >= MAX_ATTACHMENT_CHUNK_CHARS * 0.55
    ? wordBreak
    : MAX_ATTACHMENT_CHUNK_CHARS;
}

function normalizeDate(value: Date | string | null | undefined): Date {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }

  return new Date();
}
