import { IsString, IsNotEmpty, IsOptional, IsIn, IsInt, Min, Max, IsDateString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { CHUNK_TYPES, type ChunkType } from '@second-brain/ai';

/**
 * POST /search  — request body
 *
 * The only required field is `query` (the natural language question).
 * All other fields are optional filters that narrow the vector search.
 */
export class SearchRequestDto {
  /** The natural language question from the user. */
  @IsString()
  @IsNotEmpty()
  query: string;

  /**
   * The authenticated user's ID.
   * In production this will come from the JWT guard, not the body.
   * Included here for dev/demo convenience.
   */
  @IsString()
  @IsNotEmpty()
  userId: string;

  /** Restrict results to a specific chunk type. */
  @IsOptional()
  @IsIn(CHUNK_TYPES)
  chunkType?: ChunkType;

  /** Restrict results to a specific source type (e.g. "diary_entry", "calendar"). */
  @IsOptional()
  @IsString()
  sourceType?: string;

  /** ISO-8601 date — only return chunks on or after this date. */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /** ISO-8601 date — only return chunks on or before this date. */
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** How many source chunks to retrieve. Defaults to 6. Max 20. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;

  /** Minimum cosine similarity threshold [0–1]. Defaults to 0.4. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minSimilarity?: number;
}
