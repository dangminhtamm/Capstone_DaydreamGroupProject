import { createRequire } from "node:module";

import type { Prisma, PrismaClient as PrismaClientPackage } from "@prisma/client";

import type { ChunkType, MemoryChunk } from "../ai/src/index.ts";

const require = createRequire(import.meta.url);

type PrismaClientLike = Pick<PrismaClientPackage, "$disconnect" | "$executeRawUnsafe" | "$queryRawUnsafe">;

interface PrismaClientConstructor {
  new (): PrismaClientLike;
}

interface PrismaRuntimeModule {
  PrismaClient: PrismaClientConstructor;
}

export interface PersistMemoryChunkInput
  extends Omit<MemoryChunk, "id" | "createdAt" | "updatedAt"> {
  userId: string;
  chunkType: ChunkType;
  metadata: Prisma.JsonValue;
  embedding?: number[] | null;
}

function loadPrismaModule(): PrismaRuntimeModule {
  try {
    return require("./prisma/generated/client") as PrismaRuntimeModule;
  } catch {
    try {
      return require("@prisma/client") as PrismaRuntimeModule;
    } catch (error) {
      const packageError = error as Error;

      packageError.message =
        "Unable to load Prisma client. Run `pnpm --dir packages/db prisma:generate` first.\n" +
        packageError.message;
      throw packageError;
    }
  }
}

const prismaModule = loadPrismaModule();

export const PrismaClient = prismaModule.PrismaClient;

export function createPrismaClient(): PrismaClientLike {
  return new PrismaClient();
}

export function toVectorLiteral(embedding: number[]): string {
  if (embedding.length === 0) {
    throw new Error("Embedding must be a non-empty number array.");
  }

  const normalized = embedding.map((value) => {
    if (!Number.isFinite(value)) {
      throw new Error("Embedding values must be finite numbers.");
    }

    return Number(value.toFixed(6));
  });

  return `[${normalized.join(",")}]`;
}

export async function insertMemoryChunk(
  prisma: PrismaClientLike,
  input: PersistMemoryChunkInput
): Promise<void> {
  const metadataJson = JSON.stringify(input.metadata);
  const embeddingLiteral = input.embedding == null ? null : toVectorLiteral(input.embedding);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "memory_chunks" (
        "user_id",
        "source_type",
        "source_id",
        "chunk_type",
        "text",
        "metadata",
        "embedding"
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        CASE
          WHEN $7::text IS NULL THEN NULL
          ELSE $7::vector
        END
      )
    `,
    input.userId,
    input.sourceType,
    input.sourceId,
    input.chunkType,
    input.text,
    metadataJson,
    embeddingLiteral
  );
}

export async function insertMemoryChunks(
  prisma: PrismaClientLike,
  inputs: PersistMemoryChunkInput[]
): Promise<void> {
  for (const input of inputs) {
    await insertMemoryChunk(prisma, input);
  }
}

// ---------------------------------------------------------------------------
// Vector Search
// ---------------------------------------------------------------------------

/**
 * Options for filtering a vector similarity search.
 *
 * All fields are optional — omitting them means no filter is applied for that
 * dimension, giving you a pure top-K similarity search across all chunks.
 */
export interface VectorSearchOptions {
  /** The user whose chunks to search. Required — users must not see each other's data. */
  userId: string;

  /** Restrict results to a single chunk type, e.g. "action_item" or "decision". */
  chunkType?: ChunkType;

  /** Restrict results to a specific source, e.g. "diary_entry" or "calendar". */
  sourceType?: string;

  /**
   * Only return chunks whose `metadata->>'date'` is on or after this ISO-8601
   * date string (e.g. "2025-01-01").
   */
  dateFrom?: string;

  /**
   * Only return chunks whose `metadata->>'date'` is on or before this ISO-8601
   * date string (e.g. "2025-12-31").
   */
  dateTo?: string;

  /**
   * How many results to return. Defaults to 5.
   * The raw SQL uses LIMIT so only top-K rows are ever fetched from the DB.
   */
  topK?: number;

  /**
   * Minimum similarity threshold (0–1 scale, cosine similarity).
   * Chunks with `similarity < minSimilarity` are dropped from results.
   * Defaults to 0 (return everything, sorted by relevance).
   */
  minSimilarity?: number;
}

/** A single memory chunk returned by `vectorSearch`, enriched with its similarity score. */
export interface VectorSearchResult {
  id: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  chunkType: ChunkType;
  text: string;
  /** Parsed JSON metadata object (date, sourceType, sourceId). */
  metadata: Record<string, unknown>;
  createdAt: Date;
  /** Cosine similarity in the range [0, 1]. Higher = more relevant. */
  similarity: number;
}

/** Raw row shape returned by Postgres before we normalise it. */
interface RawChunkRow {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  chunk_type: string;
  text: string;
  metadata: string | Record<string, unknown> | null;
  created_at: Date | string;
  similarity: number | string;
}

/**
 * Find the most semantically similar memory chunks for a given query embedding.
 *
 * Uses pgvector's cosine-distance operator (`<=>`) so rows with embeddings
 * closer to the query vector rank highest. All metadata filters are applied
 * server-side to avoid pulling unnecessary rows into Node.
 *
 * @example
 * ```ts
 * const results = await vectorSearch(prisma, queryEmbedding, {
 *   userId: "user-123",
 *   chunkType: "action_item",
 *   topK: 10,
 *   minSimilarity: 0.7,
 * });
 * ```
 */
export async function vectorSearch(
  prisma: PrismaClientLike,
  queryEmbedding: number[],
  options: VectorSearchOptions
): Promise<VectorSearchResult[]> {
  const {
    userId,
    chunkType,
    sourceType,
    dateFrom,
    dateTo,
    topK = 5,
    minSimilarity = 0,
  } = options;

  // Format the query vector as a pgvector literal, e.g. "[0.1,0.2,...]"
  const vectorLiteral = toVectorLiteral(queryEmbedding);

  // Build WHERE clauses and bind parameters dynamically.
  // $1 is always the query vector; $2 is always userId.
  // Extra filters start at $3.
  const conditions: string[] = [
    `"user_id" = $2`,
    // Only search chunks that actually have an embedding stored
    `"embedding" IS NOT NULL`,
  ];
  const params: unknown[] = [vectorLiteral, userId];

  if (chunkType !== undefined) {
    params.push(chunkType);
    conditions.push(`"chunk_type" = $${params.length}`);
  }

  if (sourceType !== undefined) {
    params.push(sourceType);
    conditions.push(`"source_type" = $${params.length}`);
  }

  if (dateFrom !== undefined) {
    params.push(dateFrom);
    conditions.push(`("metadata"->>'date') >= $${params.length}`);
  }

  if (dateTo !== undefined) {
    params.push(dateTo);
    conditions.push(`("metadata"->>'date') <= $${params.length}`);
  }

  if (minSimilarity > 0) {
    // cosine similarity = 1 - cosine distance
    params.push(1 - minSimilarity);
    conditions.push(`("embedding" <=> $1::vector) <= $${params.length}`);
  }

  params.push(topK);
  const limitParam = `$${params.length}`;

  const whereClause = conditions.join(" AND ");

  const sql = `
    SELECT
      "id",
      "user_id",
      "source_type",
      "source_id",
      "chunk_type",
      "text",
      "metadata",
      "created_at",
      1 - ("embedding" <=> $1::vector) AS similarity
    FROM "memory_chunks"
    WHERE ${whereClause}
    ORDER BY "embedding" <=> $1::vector
    LIMIT ${limitParam}
  `;

  const rows = await (prisma.$queryRawUnsafe as (...args: unknown[]) => Promise<RawChunkRow[]>)(
    sql,
    ...params
  );

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    chunkType: row.chunk_type as ChunkType,
    text: row.text,
    metadata:
      typeof row.metadata === "string"
        ? (JSON.parse(row.metadata) as Record<string, unknown>)
        : (row.metadata ?? {}),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    similarity: Number(row.similarity),
  }));
}
