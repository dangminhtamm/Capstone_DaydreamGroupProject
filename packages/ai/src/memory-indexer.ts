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
   * Each entry maps a chunkIndex to its extracted entity mentions.
   * If not provided, entity mentions are returned but not persisted.
   */
  insertEntityMentions?: (
    mentions: Array<{
      chunkId: string;
      entityType: string;
      entityValue: string;
    }>,
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
  const allEntityMentions: Array<{
    chunkIndex: number;
    entityType: "person" | "project" | "tag" | "goal" | "habit";
    entityValue: string;
  }> = [];

  for (const chunk of persistedChunks) {
    const mentions = extractEntityMentionsFromMetadata(chunk.metadata);
    for (const mention of mentions) {
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

  // If a persistence callback is provided, resolve chunkIds and persist
  let persistedEntityCount = 0;
  if (input.insertEntityMentions && allEntityMentions.length > 0) {
    try {
      // Resolve chunk IDs: chunks are identified by (userId, sourceType, sourceId, chunkIndex)
      // Since we just upserted them, we can query for their IDs
      const chunkIdPayloads = allEntityMentions.map((m) => ({
        chunkId: "", // Will be resolved below
        entityType: m.entityType,
        entityValue: m.entityValue,
        chunkIndex: m.chunkIndex,
      }));

      // We need the actual DB chunk IDs. Query them by the unique key.
      // For now, we pass the source identifiers so the caller can resolve.
      // The diary service will handle this in a transaction.
      await input.insertEntityMentions(
        chunkIdPayloads.map((p) => ({
          // The chunk ID will be resolved by the caller using source key lookup
          chunkId: `${input.userId}:${persistedChunks[0]?.sourceType ?? "diary"}:${input.diaryId}:${p.chunkIndex}`,
          entityType: p.entityType,
          entityValue: p.entityValue,
        })),
      );
      persistedEntityCount = allEntityMentions.length;
    } catch (error) {
      console.error("Failed to persist entity mentions (non-fatal):", error);
      // Entity mention persistence is best-effort — don't fail the whole pipeline
    }
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

