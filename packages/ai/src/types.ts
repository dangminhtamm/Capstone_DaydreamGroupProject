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

/**
 * A single retrieved memory chunk, as returned by the vector search layer.
 * Intentionally mirrors `VectorSearchResult` from `packages/db` so that
 * the query processor can remain fully decoupled from the DB package.
 */
export interface SearchResult {
  id: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  chunkType: ChunkType;
  text: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  /** Cosine similarity score [0, 1]. Higher = more relevant. */
  similarity: number;
}

/** The final output of `processQuery` — a grounded answer with traceable sources. */
export interface QueryResult {
  /** The AI-generated answer, grounded in the retrieved chunks. */
  answer: string;
  /**
   * The chunks that were used as context to generate the answer.
   * Use these to render citations in the UI.
   */
  sources: SearchResult[];
}

