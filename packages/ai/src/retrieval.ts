// packages/ai/src/retrieval.ts
import { Prisma } from "@second-brain/db";
import { createDefaultEmbeddingProvider } from "./embedding.ts";

type PrismaSql = ReturnType<typeof Prisma.sql>;

export interface RetrievalFilters {
  chunkType?: string;
  chunkTypes?: string[];
  sourceType?: string;
  sourceTypes?: string[];
  preferredChunkTypes?: string[];
  preferredSourceTypes?: string[];
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
  retrievalMode: "vector" | "lexical" | "hybrid" | "temporal";
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

  return retrieveMemoryWithEmbedding(
    query,
    userId,
    dbClient,
    embedding,
    filters,
  );
}

export async function retrieveMemoryWithEmbedding(
  query: string,
  userId: string,
  dbClient: any,
  embedding: number[],
  filters: RetrievalFilters = {},
): Promise<MemorySearchHit[]> {
  if (!query.trim()) return [];

  const vectorString = `[${embedding.join(",")}]`;
  const lexicalQuery = buildLexicalTsQuery(query);

  const limit = Math.min(filters.limit ?? 8, 20);
  const candidateLimit = Math.max(limit * 5, 50);
  const maxDistance = Math.min(filters.maxDistance ?? 0.42, 0.55);
  const vectorWeight = clampWeight(filters.vectorWeight ?? 0.7);
  const lexicalWeight = clampWeight(filters.lexicalWeight ?? 0.3);
  const lexicalOnlyWeight = 0.75;
  const preferredSourceTypes = normalizeStringList(filters.preferredSourceTypes);
  const preferredChunkTypes = normalizeStringList(filters.preferredChunkTypes);

  const conditions: PrismaSql[] = [Prisma.sql`user_id = ${userId}`];

  if (filters.chunkType) {
    conditions.push(Prisma.sql`chunk_type = ${filters.chunkType}`);
  }

  if (filters.chunkTypes?.length) {
    conditions.push(Prisma.sql`chunk_type IN (${Prisma.join(filters.chunkTypes)})`);
  }

  if (filters.sourceType) {
    conditions.push(Prisma.sql`source_type = ${filters.sourceType}`);
  }

  if (filters.sourceTypes?.length) {
    conditions.push(Prisma.sql`source_type IN (${Prisma.join(filters.sourceTypes)})`);
  }

  if (filters.startDate) {
    conditions.push(Prisma.sql`occurred_at >= ${filters.startDate}`);
  }

  if (filters.endDate) {
    conditions.push(Prisma.sql`occurred_at <= ${filters.endDate}`);
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  const sourceTypeBoost = preferredSourceTypes.length
    ? Prisma.sql`
      CASE WHEN memory_chunks.source_type IN (${Prisma.join(preferredSourceTypes)})
        THEN 0.08 ELSE 0 END
    `
    : Prisma.sql`0`;
  const chunkTypeBoost = preferredChunkTypes.length
    ? Prisma.sql`
      CASE WHEN memory_chunks.chunk_type IN (${Prisma.join(preferredChunkTypes)})
        THEN 0.06 ELSE 0 END
    `
    : Prisma.sql`0`;
  const searchDocument = Prisma.sql`
    to_tsvector(
      'simple',
      coalesce(text, '') || ' ' || coalesce(evidence, '') || ' ' || coalesce(metadata::text, '')
    )
  `;

  let rawResults: MemorySearchHit[] = [];
  try {
    rawResults = await dbClient.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('hnsw.ef_search', '80', true), set_config('hnsw.iterative_scan', 'strict_order', true)",
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
              ts_rank_cd(${searchDocument}, query_input.ts_query) * 8.0
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
            CASE
              WHEN vector_ranked.id IS NOT NULL AND lexical_ranked.id IS NOT NULL THEN
                LEAST(
                  1.0,
                  (${vectorWeight} * COALESCE(vector_ranked.vector_similarity, 0))
                    + (${lexicalWeight} * COALESCE(lexical_ranked.lexical_score, 0))
                    + ${sourceTypeBoost}
                    + ${chunkTypeBoost}
                )
              WHEN vector_ranked.id IS NOT NULL THEN LEAST(
                1.0,
                COALESCE(vector_ranked.vector_similarity, 0)
                  + ${sourceTypeBoost}
                  + ${chunkTypeBoost}
              )
              ELSE LEAST(
                1.0,
                (${lexicalOnlyWeight} * COALESCE(lexical_ranked.lexical_score, 0))
                  + ${sourceTypeBoost}
                  + ${chunkTypeBoost}
              )
            END AS similarity
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
          OR "lexicalScore" >= 0.65
        ORDER BY similarity DESC, "occurredAt" DESC
        LIMIT ${limit};
      `;
    });
  } catch (error) {
    console.error("Error when retrieve memory:", error);
    throw error;
  }

  // Post-filter: remove lexical-only hits with low scores that are likely noise.
  // These occur when a keyword happens to match but the semantic meaning is unrelated.
  const MIN_LEXICAL_ONLY_SIMILARITY = 0.6;
  const MIN_LEXICAL_ONLY_SCORE = 0.75;
  const MIN_OVERALL_SIMILARITY = 0.45;
  const MIN_VECTOR_ONLY_SIMILARITY = 0.58;
  const MIN_HYBRID_VECTOR_SIMILARITY = 0.35;

  const strictResults = rawResults.filter((hit) => {
    // Always filter out very low similarity hits regardless of mode
    if (hit.similarity < MIN_OVERALL_SIMILARITY) return false;

    if (
      hit.retrievalMode === "vector" &&
      hit.vectorSimilarity < MIN_VECTOR_ONLY_SIMILARITY
    ) {
      return false;
    }

    // Lexical-only hits with low scores are usually false positives
    if (
      hit.retrievalMode === "lexical" &&
      (hit.similarity < MIN_LEXICAL_ONLY_SIMILARITY ||
        hit.lexicalScore < MIN_LEXICAL_ONLY_SCORE)
    ) {
      return false;
    }

    if (
      hit.retrievalMode === "hybrid" &&
      hit.vectorSimilarity < MIN_HYBRID_VECTOR_SIMILARITY
    ) {
      return false;
    }

    return true;
  });

  if (strictResults.length || !shouldUseTemporalFallback(filters)) {
    return strictResults;
  }

  return retrieveTemporalFallback(dbClient, whereClause, vectorString, limit, {
    sourceTypeBoost,
    chunkTypeBoost,
  });
}

async function retrieveTemporalFallback(
  dbClient: any,
  whereClause: PrismaSql,
  vectorString: string,
  limit: number,
  boosts: {
    sourceTypeBoost: PrismaSql;
    chunkTypeBoost: PrismaSql;
  },
): Promise<MemorySearchHit[]> {
  return dbClient.$queryRaw<MemorySearchHit[]>`
    SELECT
      memory_chunks.id,
      memory_chunks.source_type AS "sourceType",
      memory_chunks.source_id AS "sourceId",
      memory_chunks.chunk_type AS "chunkType",
      memory_chunks.text,
      memory_chunks.evidence,
      memory_chunks.metadata,
      memory_chunks.occurred_at AS "occurredAt",
      CASE
        WHEN memory_chunks.embedding IS NULL THEN NULL
        ELSE memory_chunks.embedding <=> ${vectorString}::vector
      END AS distance,
      CASE
        WHEN memory_chunks.embedding IS NULL THEN 0
        ELSE GREATEST(0, 1 - (memory_chunks.embedding <=> ${vectorString}::vector))
      END AS "vectorSimilarity",
      0 AS "lexicalScore",
      'temporal' AS "retrievalMode",
      LEAST(
        1.0,
        0.64
          + ${boosts.sourceTypeBoost}
          + ${boosts.chunkTypeBoost}
          + CASE
              WHEN memory_chunks.embedding IS NULL THEN 0
              ELSE GREATEST(0, 1 - (memory_chunks.embedding <=> ${vectorString}::vector)) * 0.1
            END
      ) AS similarity
    FROM memory_chunks
    ${whereClause}
    ORDER BY
      similarity DESC,
      memory_chunks.occurred_at DESC,
      memory_chunks.chunk_index ASC
    LIMIT ${limit};
  `;
}

function shouldUseTemporalFallback(filters: RetrievalFilters): boolean {
  if (!filters.startDate || !filters.endDate) return false;

  const start = filters.startDate.getTime();
  const end = filters.endDate.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return false;
  }

  const maxRangeMs = 36 * 60 * 60 * 1000;
  return end - start <= maxRangeMs;
}

function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeStringList(values: string[] | undefined): string[] {
  if (!values?.length) return [];
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
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
    "been",
    "but",
    "can",
    "cua",
    "của",
    "cho",
    "co",
    "có",
    "cung",
    "cũng",
    "da",
    "đã",
    "dang",
    "đang",
    "day",
    "đây",
    "decide",
    "decided",
    "de",
    "để",
    "did",
    "do",
    "duoc",
    "được",
    "gi",
    "gì",
    "hay",
    "i",
    "in",
    "is",
    "khong",
    "không",
    "la",
    "là",
    "lam",
    "làm",
    "ma",
    "mà",
    "mot",
    "một",
    "my",
    "nay",
    "này",
    "nhu",
    "như",
    "nhung",
    "nhưng",
    "of",
    "on",
    "se",
    "sẽ",
    "thi",
    "thì",
    "the",
    "then",
    "this",
    "to",
    "toi",
    "tôi",
    "trong",
    "va",
    "và",
    "ve",
    "về",
    "voi",
    "với",
    "was",
    "were",
    "what",
    "when",
    "where",
    "who",
    "with",
    "team",
    "user",
    "users",
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
