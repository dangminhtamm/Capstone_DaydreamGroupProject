// packages/ai/src/types.ts
import type { ChunkType } from "./chunk-types.ts";

export type { ChunkType };

export interface MemoryChunkMetadata {
  date: string | null;
  sourceType: 'diary' | 'calendar' | 'gmail' | string;
  sourceId: string;
  chunkIndex: number;      
  chunkType: ChunkType;
  people?: string[];       
  projects?: string[];    
  tags?: string[];
  importance?: number;    
  sourceTitle?: string;
  sourceUrl?: string;
  startOffset?: number;    
  endOffset?: number;
  calendarEventId?: string; 
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

/** A single memory chunk returned by vector search, enriched with similarity score. */
export interface SearchResult {
  id: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  chunkType: string;
  text: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  similarity: number;
}

/** The result of a full RAG query: an AI-generated answer plus the source chunks used. */
export interface QueryResult {
  answer: string;
  sources: SearchResult[];
}