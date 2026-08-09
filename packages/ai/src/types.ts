// packages/ai/src/types.ts
export const CHUNK_TYPES = [
  "meeting_outcome",
  "feedback",
  "task_update",
  "decision",
  "action_item",
  "emotional_reflection",
  "general_note",
  "reflection",
  "event",
  "general",
] as const;

export type ChunkType = (typeof CHUNK_TYPES)[number];

export interface MemoryChunkMetadata {
  date: string | null;
  memoryDate?: string | null;
  sourceType: "diary" | "calendar" | "gmail" | string;
  sourceId: string;
  chunkIndex: number;
  chunkType: ChunkType;
  people?: string[];
  projects?: string[];
  goals?: string[];
  habits?: string[];
  tags?: string[];
  importance?: number;
  sourceTitle?: string;
  sourceUrl?: string;
  startOffset?: number;
  endOffset?: number;
  calendarEventId?: string;
  diaryEntryId?: string;
  fileType?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  embeddingUpdatedAt?: string;
}

export function withMemoryDate<T extends MemoryChunkMetadata>(
  metadata: T,
): T & { date: string | null; memoryDate: string | null } {
  const memoryDate = metadata.memoryDate ?? metadata.date ?? null;

  return {
    ...metadata,
    date: metadata.date ?? memoryDate,
    memoryDate,
  };
}

export interface MemoryChunk {
  id?: string;
  userId?: string;
  sourceType: string;
  sourceId: string;
  chunkType: ChunkType;
  text: string;
  metadata: MemoryChunkMetadata;
  embedding?: number[] | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ChunkedMemoryChunk = Omit<
  MemoryChunk,
  "id" | "userId" | "embedding" | "createdAt" | "updatedAt"
>;

export interface ChunkingOptions {
  sourceType?: string;
  sourceId?: string;
  date?: string | null;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

export interface SemanticChunk {
  text: string;
  metadata: Partial<MemoryChunkMetadata>;
}

export interface MemoryDbClient {
  $transaction<T>(fn: (tx: any) => Promise<T>): Promise<T>;
}
