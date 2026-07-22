import { PrismaPg } from "@prisma/adapter-pg";
import PrismaPackage, {
  type PrismaClient as PrismaClientPackage,
} from "@prisma/client";
import { Pool } from "pg";
import { toVectorLiteral } from "./src/vector.js";

export * from "./src/search-history.js";
export { toVectorLiteral } from "./src/vector.js";
const { Prisma, PrismaClient } = PrismaPackage;

export type PrismaClientLike = Pick<
  PrismaClientPackage,
  "$disconnect" | "$executeRawUnsafe" | "$queryRawUnsafe" | "$queryRaw" | "$transaction"
>;

export interface PersistMemoryChunkInput {
  userId: string;
  sourceType: string;
  sourceId: string;
  chunkIndex?: number;
  chunkType: string;
  text: string;
  evidence?: string | null;
  metadata?: unknown;
  occurredAt?: Date | string | null;
  embedding?: number[] | null;
}

export { Prisma, PrismaClient };

let defaultPrismaClient: PrismaClientLike | null = null;

export function createPrismaClient(): PrismaClientLike {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return new PrismaClient();
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

function getDefaultPrismaClient(): PrismaClientLike {
  defaultPrismaClient ??= createPrismaClient();
  return defaultPrismaClient;
}

export async function insertMemoryChunk(
  prismaOrInput: PrismaClientLike | PersistMemoryChunkInput,
  maybeInput?: PersistMemoryChunkInput
): Promise<void> {
  const prisma = maybeInput
    ? (prismaOrInput as PrismaClientLike)
    : getDefaultPrismaClient();
  const input = maybeInput ?? (prismaOrInput as PersistMemoryChunkInput);
  const metadataJson = JSON.stringify(input.metadata ?? {});
  const metadataRecord =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? (input.metadata as Record<string, unknown>)
      : {};
  const chunkIndex =
    input.chunkIndex ??
    (typeof metadataRecord.chunkIndex === "number" ? metadataRecord.chunkIndex : 0);
  const occurredAt =
    input.occurredAt == null ? new Date() : new Date(input.occurredAt);
  const embeddingLiteral = input.embedding == null ? null : toVectorLiteral(input.embedding);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "memory_chunks" (
        "id",
        "user_id",
        "source_type",
        "source_id",
        "chunk_index",
        "chunk_type",
        "text",
        "evidence",
        "metadata",
        "occurred_at",
        "embedding"
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8::jsonb,
        $9,
        CASE
          WHEN $10::text IS NULL THEN NULL
          ELSE $10::vector
        END
      )
      ON CONFLICT ("user_id", "source_type", "source_id", "chunk_index")
      DO UPDATE SET
        "chunk_type" = EXCLUDED."chunk_type",
        "text" = EXCLUDED."text",
        "evidence" = EXCLUDED."evidence",
        "metadata" = EXCLUDED."metadata",
        "occurred_at" = EXCLUDED."occurred_at",
        "embedding" = EXCLUDED."embedding",
        "updated_at" = now()
    `,
    input.userId,
    input.sourceType,
    input.sourceId,
    chunkIndex,
    input.chunkType,
    input.text,
    input.evidence ?? null,
    metadataJson,
    occurredAt,
    embeddingLiteral
  );
}

export async function insertMemoryChunks(
  prismaOrInputs: PrismaClientLike | PersistMemoryChunkInput[],
  maybeInputs?: PersistMemoryChunkInput[]
): Promise<void> {
  const prisma = maybeInputs
    ? (prismaOrInputs as PrismaClientLike)
    : getDefaultPrismaClient();
  const inputs = maybeInputs ?? (prismaOrInputs as PersistMemoryChunkInput[]);

  for (const input of inputs) {
    await insertMemoryChunk(prisma, input);
  }
}

export interface MemorySourceRef {
  userId: string;
  sourceType: string;
  sourceId: string;
}

export interface PruneMemoryChunksInput extends MemorySourceRef {
  keepChunkCount: number;
}

export async function deleteMemoryChunksForSource(
  prismaOrRef: PrismaClientLike | MemorySourceRef,
  maybeRef?: MemorySourceRef
): Promise<void> {
  const prisma = maybeRef
    ? (prismaOrRef as PrismaClientLike)
    : getDefaultPrismaClient();
  const ref = maybeRef ?? (prismaOrRef as MemorySourceRef);

  await prisma.$executeRawUnsafe(
    `
      DELETE FROM "memory_chunks"
      WHERE "user_id" = $1
        AND "source_type" = $2
        AND "source_id" = $3
    `,
    ref.userId,
    ref.sourceType,
    ref.sourceId
  );
}

export async function pruneMemoryChunksForSource(
  prismaOrInput: PrismaClientLike | PruneMemoryChunksInput,
  maybeInput?: PruneMemoryChunksInput
): Promise<void> {
  const prisma = maybeInput
    ? (prismaOrInput as PrismaClientLike)
    : getDefaultPrismaClient();
  const input = maybeInput ?? (prismaOrInput as PruneMemoryChunksInput);

  await prisma.$executeRawUnsafe(
    `
      DELETE FROM "memory_chunks"
      WHERE "user_id" = $1
        AND "source_type" = $2
        AND "source_id" = $3
        AND "chunk_index" >= $4
    `,
    input.userId,
    input.sourceType,
    input.sourceId,
    Math.max(0, input.keepChunkCount)
  );
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
  chunkType?: string;

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
  chunkIndex: number;
  chunkType: string;
  text: string;
  evidence: string | null;
  /** Parsed JSON metadata object (date, sourceType, sourceId). */
  metadata: Record<string, unknown>;
  occurredAt: Date;
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
  chunk_index: number;
  chunk_type: string;
  text: string;
  evidence: string | null;
  metadata: string | Record<string, unknown> | null;
  occurred_at: Date | string;
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
    conditions.push(`"occurred_at" >= $${params.length}`);
  }

  if (dateTo !== undefined) {
    params.push(dateTo);
    conditions.push(`"occurred_at" <= $${params.length}`);
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
      "chunk_index",
      "chunk_type",
      "text",
      "evidence",
      "metadata",
      "occurred_at",
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
    chunkIndex: Number(row.chunk_index),
    chunkType: row.chunk_type,
    text: row.text,
    evidence: row.evidence,
    metadata:
      typeof row.metadata === "string"
        ? (JSON.parse(row.metadata) as Record<string, unknown>)
        : (row.metadata ?? {}),
    occurredAt: row.occurred_at instanceof Date ? row.occurred_at : new Date(row.occurred_at),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    similarity: Number(row.similarity),
  }));
}

// ---------------------------------------------------------------------------
// Entity Mentions (Knowledge Graph)
// ---------------------------------------------------------------------------

export interface EntityMentionInput {
  chunkId: string;
  entityType: string; // 'person', 'project', 'tag'
  entityValue: string;
}

/**
 * Insert entity mentions for memory chunks.
 * Expects actual chunk IDs (UUIDs). Skips duplicates via ON CONFLICT.
 */
export async function insertEntityMentions(
  prismaOrInputs: PrismaClientLike | EntityMentionInput[],
  maybeInputs?: EntityMentionInput[],
): Promise<void> {
  const prisma = maybeInputs
    ? (prismaOrInputs as PrismaClientLike)
    : getDefaultPrismaClient();
  const inputs = maybeInputs ?? (prismaOrInputs as EntityMentionInput[]);

  if (!inputs.length) return;

  // Deduplicate within the batch
  const seen = new Set<string>();
  const unique = inputs.filter((m) => {
    const key = `${m.chunkId}:${m.entityType}:${m.entityValue}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const mention of unique) {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "entity_mentions" ("id", "chunk_id", "entity_type", "entity_value")
        VALUES (gen_random_uuid(), $1, $2, $3)
        ON CONFLICT DO NOTHING
      `,
      mention.chunkId,
      mention.entityType,
      mention.entityValue,
    );
  }
}

/**
 * Delete all entity mentions associated with chunks from a given source.
 * Used before re-indexing to clear stale entity data.
 */
export async function deleteEntityMentionsForSource(
  prismaOrRef: PrismaClientLike | MemorySourceRef,
  maybeRef?: MemorySourceRef,
): Promise<void> {
  const prisma = maybeRef
    ? (prismaOrRef as PrismaClientLike)
    : getDefaultPrismaClient();
  const ref = maybeRef ?? (prismaOrRef as MemorySourceRef);

  await prisma.$executeRawUnsafe(
    `
      DELETE FROM "entity_mentions"
      WHERE "chunk_id" IN (
        SELECT "id" FROM "memory_chunks"
        WHERE "user_id" = $1
          AND "source_type" = $2
          AND "source_id" = $3
      )
    `,
    ref.userId,
    ref.sourceType,
    ref.sourceId,
  );
}

/**
 * Resolve memory chunk IDs from source keys (userId + sourceType + sourceId + chunkIndex).
 * Returns a map of chunkIndex → chunkId (UUID).
 */
export async function resolveMemoryChunkIds(
  prismaOrArgs: PrismaClientLike | { userId: string; sourceType: string; sourceId: string },
  maybeArgs?: { userId: string; sourceType: string; sourceId: string },
): Promise<Map<number, string>> {
  const prisma = maybeArgs
    ? (prismaOrArgs as PrismaClientLike)
    : getDefaultPrismaClient();
  const args = maybeArgs ?? (prismaOrArgs as { userId: string; sourceType: string; sourceId: string });

  const rows = await (prisma.$queryRawUnsafe as (...a: unknown[]) => Promise<{ id: string; chunk_index: number }[]>)(
    `
      SELECT "id", "chunk_index"
      FROM "memory_chunks"
      WHERE "user_id" = $1
        AND "source_type" = $2
        AND "source_id" = $3
      ORDER BY "chunk_index"
    `,
    args.userId,
    args.sourceType,
    args.sourceId,
  );

  const map = new Map<number, string>();
  for (const row of rows) {
    map.set(Number(row.chunk_index), row.id);
  }
  return map;
}

