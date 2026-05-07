// packages/ai/src/retrieval.ts
import { Prisma } from "@second-brain/db";
import { createDefaultEmbeddingProvider } from "./embedding.ts";

export interface RetrievalFilters {
  chunkType?: string;
  sourceType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  maxDistance?: number; 
}

export interface MemorySearchHit {
  id: string;
  sourceType: string;
  sourceId: string;
  chunkType: string;
  text: string;
  evidence: string | null;
  metadata: unknown;
  occurredAt: Date;
  distance: number;
  similarity: number;
}

export async function retrieveMemory(
  query: string,
  userId: string,
  dbClient: any, 
  filters: RetrievalFilters = {},
): Promise<MemorySearchHit[]> {
  if (!query.trim()) return [];

  const embedder = createDefaultEmbeddingProvider();
  const embedding = await embedder.embedQuery(query);
  const vectorString = `[${embedding.join(",")}]`;

  const limit = Math.min(filters.limit ?? 8, 20);
  const candidateLimit = Math.max(limit * 4, 40);
  const maxDistance = filters.maxDistance ?? 0.35;

  const conditions: Prisma.Sql[] = [
    Prisma.sql`user_id = ${userId}::uuid`,
    Prisma.sql`embedding IS NOT NULL`,
  ];

  if (filters.chunkType) {
    conditions.push(Prisma.sql`chunk_type = ${filters.chunkType}`);
  }

  if (filters.sourceType) {
    conditions.push(Prisma.sql`source_type = ${filters.sourceType}`);
  }

  if (filters.startDate) {
    conditions.push(Prisma.sql`occurred_at >= ${filters.startDate}`);
  }

  if (filters.endDate) {
    conditions.push(Prisma.sql`occurred_at <= ${filters.endDate}`);
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;

  try {
    return await dbClient.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe("SET LOCAL hnsw.ef_search = 80");
      await tx.$executeRawUnsafe(
        "SET LOCAL hnsw.iterative_scan = strict_order",
      );

      return tx.$queryRaw<MemorySearchHit[]>`
        WITH ranked AS (
          SELECT
            id,
            source_type AS "sourceType",
            source_id AS "sourceId",
            chunk_type AS "chunkType",
            text,
            evidence,
            metadata,
            occurred_at AS "occurredAt",
            embedding <=> ${vectorString}::vector AS distance
          FROM memory_chunks
          ${whereClause}
          ORDER BY embedding <=> ${vectorString}::vector
          LIMIT ${candidateLimit}
        )
        SELECT
          *,
          1 - distance AS similarity
        FROM ranked
        WHERE distance <= ${maxDistance}
        ORDER BY distance ASC
        LIMIT ${limit};
      `;
    });
  } catch (error) {
    console.error("Error when retrieve memory:", error);
    throw error;
  }
}
