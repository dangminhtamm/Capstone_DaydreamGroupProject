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
  lexicalWeight?: number;
  vectorWeight?: number;
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
  distance: number | null;
  vectorSimilarity: number;
  lexicalScore: number;
  retrievalMode: "vector" | "lexical" | "hybrid";
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
  const lexicalQuery = buildLexicalTsQuery(query);

  const limit = Math.min(filters.limit ?? 8, 20);
  const candidateLimit = Math.max(limit * 5, 50);
  const maxDistance = filters.maxDistance ?? 0.35;
  const vectorWeight = clampWeight(filters.vectorWeight ?? 0.7);
  const lexicalWeight = clampWeight(filters.lexicalWeight ?? 0.3);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`user_id = ${userId}::uuid`,
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
  const searchDocument = Prisma.sql`
    to_tsvector(
      'simple',
      coalesce(text, '') || ' ' || coalesce(evidence, '') || ' ' || coalesce(metadata::text, '')
    )
  `;

  try {
    return await dbClient.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe("SET LOCAL hnsw.ef_search = 80");
      await tx.$executeRawUnsafe(
        "SET LOCAL hnsw.iterative_scan = strict_order",
      );

      return tx.$queryRaw<MemorySearchHit[]>`
        WITH query_input AS (
          SELECT to_tsquery('simple', ${lexicalQuery}) AS ts_query
        ),
        vector_ranked AS (
          SELECT
            id,
            embedding <=> ${vectorString}::vector AS distance,
            1 - (embedding <=> ${vectorString}::vector) AS vector_similarity
          FROM memory_chunks
          ${whereClause}
            AND embedding IS NOT NULL
          ORDER BY embedding <=> ${vectorString}::vector
          LIMIT ${candidateLimit}
        ),
        lexical_ranked AS (
          SELECT
            memory_chunks.id,
            LEAST(
              1.0,
              0.65 + ts_rank_cd(${searchDocument}, query_input.ts_query) * 6.0
            ) AS lexical_score
          FROM memory_chunks
          CROSS JOIN query_input
          ${whereClause}
            AND ${searchDocument} @@ query_input.ts_query
          ORDER BY lexical_score DESC, occurred_at DESC
          LIMIT ${candidateLimit}
        ),
        candidate_ids AS (
          SELECT id FROM vector_ranked
          UNION
          SELECT id FROM lexical_ranked
        ),
        scored AS (
          SELECT
            memory_chunks.id,
            memory_chunks.source_type AS "sourceType",
            memory_chunks.source_id AS "sourceId",
            memory_chunks.chunk_type AS "chunkType",
            memory_chunks.text,
            memory_chunks.evidence,
            memory_chunks.metadata,
            memory_chunks.occurred_at AS "occurredAt",
            vector_ranked.distance,
            COALESCE(vector_ranked.vector_similarity, 0) AS "vectorSimilarity",
            COALESCE(lexical_ranked.lexical_score, 0) AS "lexicalScore",
            CASE
              WHEN vector_ranked.id IS NOT NULL AND lexical_ranked.id IS NOT NULL THEN 'hybrid'
              WHEN lexical_ranked.id IS NOT NULL THEN 'lexical'
              ELSE 'vector'
            END AS "retrievalMode",
            GREATEST(
              COALESCE(vector_ranked.vector_similarity, 0),
              COALESCE(lexical_ranked.lexical_score, 0),
              (${vectorWeight} * COALESCE(vector_ranked.vector_similarity, 0))
                + (${lexicalWeight} * COALESCE(lexical_ranked.lexical_score, 0))
            ) AS similarity
          FROM memory_chunks
          INNER JOIN candidate_ids ON candidate_ids.id = memory_chunks.id
          LEFT JOIN vector_ranked ON vector_ranked.id = memory_chunks.id
          LEFT JOIN lexical_ranked ON lexical_ranked.id = memory_chunks.id
        )
        SELECT
          id,
          "sourceType",
          "sourceId",
          "chunkType",
          text,
          evidence,
          metadata,
          "occurredAt",
          distance,
          "vectorSimilarity",
          "lexicalScore",
          "retrievalMode",
          similarity
        FROM scored
        WHERE distance <= ${maxDistance}
          OR "lexicalScore" > 0
        ORDER BY similarity DESC, "occurredAt" DESC
        LIMIT ${limit};
      `;
    });
  } catch (error) {
    console.error("Error when retrieve memory:", error);
    throw error;
  }
}

function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function buildLexicalTsQuery(query: string): string {
  const terms = extractLexicalTerms(query);
  if (!terms.length) return "secondbrainfallback";

  return terms.map((term) => `${term}:*`).join(" | ");
}

function extractLexicalTerms(query: string): string[] {
  const stopwords = new Set([
    "a",
    "an",
    "and",
    "are",
    "about",
    "cua",
    "của",
    "cho",
    "co",
    "có",
    "duoc",
    "được",
    "gi",
    "gì",
    "i",
    "in",
    "is",
    "la",
    "là",
    "my",
    "of",
    "on",
    "the",
    "to",
    "toi",
    "tôi",
    "trong",
    "va",
    "và",
    "ve",
    "về",
    "was",
    "were",
    "what",
    "when",
    "where",
    "who",
    "with",
  ]);

  const matches = query.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
  const uniqueTerms: string[] = [];

  for (const term of matches) {
    if (term.length < 2 || stopwords.has(term) || uniqueTerms.includes(term)) {
      continue;
    }

    uniqueTerms.push(term);
    if (uniqueTerms.length >= 12) break;
  }

  return uniqueTerms;
}
