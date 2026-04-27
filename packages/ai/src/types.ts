import type { ChunkType } from "./chunk-types.ts";

export interface MemoryChunkMetadata {
  date: string | null;
  sourceType: string;
  sourceId: string;
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
