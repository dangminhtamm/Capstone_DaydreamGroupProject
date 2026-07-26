import { insertMemoryChunks } from "@second-brain/db";
import { generateSemanticChunks } from "./chunker.ts";
import {
  createDefaultEmbeddingProvider,
  type AdvancedEmbeddingProvider,
} from "./embedding.ts";
import {
  extractEntityMentionsFromMetadata,
  normalizeOptionalDateToIso,
  withEmbeddings,
  type ExtractedEntityMention,
} from "./indexing-utils.ts";
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
  /** Entity mentions extracted from this chunk (people, projects, tags) */
  entityMentions?: ExtractedEntityMention[];
}

export type { ExtractedEntityMention } from "./indexing-utils.ts";

export interface ExtractedEntityMentionWithChunkIndex extends ExtractedEntityMention {
  chunkIndex: number;
}

export interface IndexMemoryFromDiaryInput {
  userId: string;
  diaryId: string;
  rawText: string;
  entryDate?: Date | string | null;
  sourceTitle?: string;
  embeddingProvider?: Pick<AdvancedEmbeddingProvider, "embedDocument">;
  insertChunks?: (chunks: PersistedMemoryChunkPayload[]) => Promise<unknown>;
  /**
   * Optional callback to persist entity mentions after chunks are inserted.
   * The caller resolves chunkIndex to actual memory_chunks.id values inside
   * its own storage boundary before writing relational EntityMention rows.
   * If not provided, entity mentions are returned but not persisted.
   */
  insertEntityMentions?: (
    mentions: ExtractedEntityMentionWithChunkIndex[],
  ) => Promise<unknown>;
}

export interface IndexMemoryFromDiaryResult {
  sourceType: "diary";
  sourceId: string;
  chunkCount: number;
  chunks: IndexedMemoryChunk[];
  /** Total number of entity mentions extracted and persisted */
  entityMentionCount: number;
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
      entityMentionCount: 0,
    };
  }

  const date = normalizeOptionalDateToIso(input.entryDate);
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
      entityMentionCount: 0,
    };
  }

  const embeddingProvider =
    input.embeddingProvider ?? createDefaultEmbeddingProvider();

  const chunkPayloads = semanticChunks.map((chunk) => ({
    userId: input.userId,
    sourceType: chunk.metadata.sourceType,
    sourceId: chunk.metadata.sourceId,
    chunkIndex: chunk.metadata.chunkIndex,
    chunkType: chunk.metadata.chunkType,
    text: chunk.text,
    evidence: chunk.evidence ?? null,
    metadata: chunk.metadata,
    occurredAt: chunk.metadata.date ? new Date(chunk.metadata.date) : new Date(),
  } satisfies Omit<PersistedMemoryChunkPayload, "embedding">));
  const persistedChunks: PersistedMemoryChunkPayload[] = await withEmbeddings(
    chunkPayloads,
    embeddingProvider,
  );

  await (input.insertChunks ?? insertMemoryChunks)(persistedChunks);

  // -----------------------------------------------------------------------
  // Entity Mention Extraction & Persistence (Knowledge Graph)
  // -----------------------------------------------------------------------
  // Extract people, projects, and tags from each chunk's metadata and
  // persist them as relational EntityMention rows for fast graph queries.
  const allEntityMentions: ExtractedEntityMentionWithChunkIndex[] = [];
  const seenEntityMentions = new Set<string>();

  for (const chunk of persistedChunks) {
    const mentions = extractEntityMentionsFromMetadata(chunk.metadata);
    for (const mention of mentions) {
      const key = `${chunk.chunkIndex}:${mention.entityType}:${mention.entityValue}`;
      if (seenEntityMentions.has(key)) continue;
      seenEntityMentions.add(key);

      allEntityMentions.push({
        chunkIndex: chunk.chunkIndex,
        ...mention,
      });
    }
  }

  // Build a map of chunkIndex -> extracted entities for the result
  const mentionsByChunkIndex = new Map<number, ExtractedEntityMention[]>();
  for (const m of allEntityMentions) {
    const list = mentionsByChunkIndex.get(m.chunkIndex) ?? [];
    list.push({ entityType: m.entityType, entityValue: m.entityValue });
    mentionsByChunkIndex.set(m.chunkIndex, list);
  }

  // If a persistence callback is provided, delegate persistence to the caller.
  // Callback errors intentionally propagate so the outbox worker can retry.
  let persistedEntityCount = 0;
  if (input.insertEntityMentions) {
    await input.insertEntityMentions(allEntityMentions);
    persistedEntityCount = allEntityMentions.length;
  }

  return {
    sourceType: "diary",
    sourceId: input.diaryId,
    chunkCount: persistedChunks.length,
    entityMentionCount: persistedEntityCount,
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
      entityMentions: mentionsByChunkIndex.get(chunk.chunkIndex),
    })),
  };
}

