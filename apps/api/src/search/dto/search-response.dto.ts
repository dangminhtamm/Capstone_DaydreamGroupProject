import type { ChunkType } from '@second-brain/ai';

/** A single source chunk included in the search response for citation rendering. */
export class SourceDto {
  /** The chunk's primary key in memory_chunks. */
  id: string;

  /** Chunk classification type (e.g. "decision", "action_item"). */
  chunkType: ChunkType;

  /** The original sentence text from the diary. */
  text: string;

  /** The source record type (e.g. "diary_entry", "calendar"). */
  sourceType: string;

  /** The ID of the source record (e.g. diary entry UUID). */
  sourceId: string;

  /** Date extracted from chunk metadata, or the chunk's createdAt date. */
  date: string;

  /** Cosine similarity score [0, 1]. */
  similarity: number;
}

/**
 * POST /search  — response body
 */
export class SearchResponseDto {
  /** The AI-generated answer grounded in the retrieved chunks. */
  answer: string;

  /**
   * The memory chunks used to generate the answer.
   * Render these as clickable citations in the frontend.
   */
  sources: SourceDto[];

  /** ISO-8601 timestamp of when the response was generated. */
  generatedAt: string;
}
