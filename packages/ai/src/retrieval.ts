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
  allowTemporalFallback?: boolean;
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
  entityScore?: number;
  retrievalMode: "vector" | "lexical" | "entity" | "hybrid" | "temporal";
  similarity: number;
}

const EMBEDDING_ERROR_LEXICAL_FALLBACK = "embedding_error_lexical";

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

export async function retrieveMemoryLexicalOnly(
  query: string,
  userId: string,
  dbClient: any,
  filters: RetrievalFilters = {},
): Promise<MemorySearchHit[]> {
  if (!query.trim()) return [];

  const lexicalQuery = buildLexicalTsQuery(query);
  const limit = Math.min(filters.limit ?? 8, 20);
  const candidateLimit = Math.max(limit * 5, 50);
  const whereClause = buildWhereClause(userId, filters);
  const sourceTypeBoost = buildSourceTypeBoost(filters);
  const chunkTypeBoost = buildChunkTypeBoost(filters);
  const searchDocument = buildSearchDocument();
  const entityRankingCte = buildEntityRankingCte(query, userId, filters, candidateLimit);

  let rawResults: MemorySearchHit[] = [];
  try {
    rawResults = await dbClient.$queryRaw<MemorySearchHit[]>`
      WITH query_input AS (
        SELECT to_tsquery('simple', ${lexicalQuery}) AS ts_query
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
      ${entityRankingCte},
      candidate_ids AS (
        SELECT id FROM lexical_ranked
        UNION
        SELECT id FROM entity_ranked
      )
      SELECT
        memory_chunks.id,
        memory_chunks.source_type AS "sourceType",
        memory_chunks.source_id AS "sourceId",
        memory_chunks.chunk_type AS "chunkType",
        memory_chunks.text,
        memory_chunks.evidence,
        memory_chunks.metadata,
        memory_chunks.occurred_at AS "occurredAt",
        NULL AS distance,
        0 AS "vectorSimilarity",
        COALESCE(lexical_ranked.lexical_score, 0) AS "lexicalScore",
        COALESCE(entity_ranked.entity_score, 0) AS "entityScore",
        CASE
          WHEN lexical_ranked.id IS NOT NULL AND entity_ranked.id IS NOT NULL THEN 'hybrid'
          WHEN entity_ranked.id IS NOT NULL THEN 'entity'
          ELSE 'lexical'
        END AS "retrievalMode",
        CASE
          WHEN lexical_ranked.id IS NOT NULL THEN LEAST(
            1.0,
            (0.75 * lexical_ranked.lexical_score)
              + (0.12 * COALESCE(entity_ranked.entity_score, 0))
              + ${sourceTypeBoost}
              + ${chunkTypeBoost}
          )
          ELSE LEAST(
            1.0,
            0.62 + (0.3 * COALESCE(entity_ranked.entity_score, 0))
              + ${sourceTypeBoost}
              + ${chunkTypeBoost}
          )
        END AS similarity
      FROM memory_chunks
      INNER JOIN candidate_ids ON candidate_ids.id = memory_chunks.id
      LEFT JOIN lexical_ranked ON lexical_ranked.id = memory_chunks.id
      LEFT JOIN entity_ranked ON entity_ranked.id = memory_chunks.id
      ORDER BY similarity DESC, memory_chunks.occurred_at DESC
      LIMIT ${limit};
    `;
  } catch (error) {
    console.error("Error when retrieve lexical-only memory:", error);
    throw error;
  }

  const strictResults = filterStrictResults(
    rawResults.map(markEmbeddingErrorLexicalFallback),
  );

  if (!shouldMergeTemporalFallback(filters, strictResults.length, limit)) {
    return strictResults;
  }

  const temporalResults = await retrieveTemporalFallbackWithoutEmbedding(
    dbClient,
    whereClause,
    limit,
    {
      sourceTypeBoost,
      chunkTypeBoost,
    },
  );

  if (!strictResults.length) return temporalResults.map(markEmbeddingErrorLexicalFallback);

  return dedupeHits([
    ...strictResults,
    ...temporalResults.map(markEmbeddingErrorLexicalFallback),
  ])
    .sort(compareHits)
    .slice(0, limit);
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
  const whereClause = buildWhereClause(userId, filters);
  const sourceTypeBoost = buildSourceTypeBoost(filters);
  const chunkTypeBoost = buildChunkTypeBoost(filters);
  const searchDocument = buildSearchDocument();
  const entityRankingCte = buildEntityRankingCte(query, userId, filters, candidateLimit);

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
        ${entityRankingCte},
        candidate_ids AS (
          SELECT id FROM vector_ranked
          UNION
          SELECT id FROM lexical_ranked
          UNION
          SELECT id FROM entity_ranked
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
            COALESCE(entity_ranked.entity_score, 0) AS "entityScore",
            CASE
              WHEN entity_ranked.id IS NOT NULL AND (
                vector_ranked.id IS NOT NULL OR lexical_ranked.id IS NOT NULL
              ) THEN 'hybrid'
              WHEN vector_ranked.id IS NOT NULL AND lexical_ranked.id IS NOT NULL THEN 'hybrid'
              WHEN lexical_ranked.id IS NOT NULL THEN 'lexical'
              WHEN entity_ranked.id IS NOT NULL THEN 'entity'
              ELSE 'vector'
            END AS "retrievalMode",
            CASE
              WHEN vector_ranked.id IS NOT NULL AND lexical_ranked.id IS NOT NULL THEN
                LEAST(
                  1.0,
                  (${vectorWeight} * COALESCE(vector_ranked.vector_similarity, 0))
                    + (${lexicalWeight} * COALESCE(lexical_ranked.lexical_score, 0))
                    + (0.12 * COALESCE(entity_ranked.entity_score, 0))
                    + ${sourceTypeBoost}
                    + ${chunkTypeBoost}
                )
              WHEN vector_ranked.id IS NOT NULL THEN LEAST(
                1.0,
                COALESCE(vector_ranked.vector_similarity, 0)
                  + (0.1 * COALESCE(entity_ranked.entity_score, 0))
                  + ${sourceTypeBoost}
                  + ${chunkTypeBoost}
              )
              WHEN lexical_ranked.id IS NOT NULL THEN LEAST(
                1.0,
                (${lexicalOnlyWeight} * COALESCE(lexical_ranked.lexical_score, 0))
                  + (0.12 * COALESCE(entity_ranked.entity_score, 0))
                  + ${sourceTypeBoost}
                  + ${chunkTypeBoost}
              )
              ELSE LEAST(
                1.0,
                0.62 + (0.3 * COALESCE(entity_ranked.entity_score, 0))
                  + ${sourceTypeBoost}
                  + ${chunkTypeBoost}
              )
            END AS similarity
          FROM memory_chunks
          INNER JOIN candidate_ids ON candidate_ids.id = memory_chunks.id
          LEFT JOIN vector_ranked ON vector_ranked.id = memory_chunks.id
          LEFT JOIN lexical_ranked ON lexical_ranked.id = memory_chunks.id
          LEFT JOIN entity_ranked ON entity_ranked.id = memory_chunks.id
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
          "entityScore",
          "retrievalMode",
          similarity
        FROM scored
        WHERE distance <= ${maxDistance}
          OR "lexicalScore" >= 0.65
          OR "entityScore" >= 0.8
        ORDER BY similarity DESC, "occurredAt" DESC
        LIMIT ${limit};
      `;
    });
  } catch (error) {
    console.error("Error when retrieve memory:", error);
    throw error;
  }

  const strictResults = filterStrictResults(rawResults);

  if (!shouldMergeTemporalFallback(filters, strictResults.length, limit)) {
    return strictResults;
  }

  const temporalResults = await retrieveTemporalFallback(dbClient, whereClause, vectorString, limit, {
    sourceTypeBoost,
    chunkTypeBoost,
  });

  if (!strictResults.length) return temporalResults;

  return dedupeHits([...strictResults, ...temporalResults])
    .sort(compareHits)
    .slice(0, limit);
}

function filterStrictResults(rawResults: MemorySearchHit[]): MemorySearchHit[] {
  // Post-filter: remove lexical-only hits with low scores that are likely noise.
  // These occur when a keyword happens to match but the semantic meaning is unrelated.
  const MIN_LEXICAL_ONLY_SIMILARITY = 0.6;
  const MIN_LEXICAL_ONLY_SCORE = 0.75;
  const MIN_OVERALL_SIMILARITY = 0.45;
  const MIN_VECTOR_ONLY_SIMILARITY = 0.58;
  const MIN_HYBRID_VECTOR_SIMILARITY = 0.35;
  const MIN_ENTITY_SCORE = 0.8;

  return rawResults.filter((hit) => {
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
      hit.vectorSimilarity < MIN_HYBRID_VECTOR_SIMILARITY &&
      hit.lexicalScore < MIN_LEXICAL_ONLY_SCORE &&
      (hit.entityScore ?? 0) < MIN_ENTITY_SCORE
    ) {
      return false;
    }

    if (
      hit.retrievalMode === "entity" &&
      (hit.entityScore ?? 0) < MIN_ENTITY_SCORE
    ) {
      return false;
    }

    return true;
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
      0 AS "entityScore",
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

async function retrieveTemporalFallbackWithoutEmbedding(
  dbClient: any,
  whereClause: PrismaSql,
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
      NULL AS distance,
      0 AS "vectorSimilarity",
      0 AS "lexicalScore",
      0 AS "entityScore",
      'temporal' AS "retrievalMode",
      LEAST(
        1.0,
        0.64
          + ${boosts.sourceTypeBoost}
          + ${boosts.chunkTypeBoost}
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

function buildEntityRankingCte(
  query: string,
  userId: string,
  filters: RetrievalFilters,
  candidateLimit: number,
): PrismaSql {
  const terms = extractEntityQueryTerms(query);
  const normalizedQuery = normalizeEntityText(query);
  const searchableTerms = terms.length ? terms : ["secondbrain-no-entity-match"];
  const entityValue = Prisma.sql`
    COALESCE(NULLIF(entity_mentions.entity_value_normalized, ''), lower(entity_mentions.entity_value))
  `;
  const exactMatch = Prisma.sql`${entityValue} IN (${Prisma.join(searchableTerms)})`;
  const fullValueMatch = Prisma.sql`POSITION(${entityValue} IN ${normalizedQuery}) > 0`;
  const partialMatch = Prisma.sql`(${Prisma.join(
    searchableTerms.map((term) => Prisma.sql`${entityValue} LIKE ${`%${term}%`}`),
    " OR ",
  )})`;
  const entityWhereClause = buildEntityWhereClause(userId, filters);

  return Prisma.sql`
    entity_ranked AS (
      SELECT
        entity_mentions.chunk_id AS id,
        LEAST(
          1.0,
          MAX(
            CASE
              WHEN ${exactMatch} THEN 0.96
              WHEN ${fullValueMatch} THEN 0.9
              ELSE 0.8
            END
            + CASE
                WHEN entity_mentions.entity_type IN ('person', 'project') THEN 0.03
                ELSE 0
              END
          )
        ) AS entity_score
      FROM entity_mentions
      INNER JOIN memory_chunks entity_chunks
        ON entity_chunks.id = entity_mentions.chunk_id
      ${entityWhereClause}
        AND (${exactMatch} OR ${fullValueMatch} OR ${partialMatch})
      GROUP BY entity_mentions.chunk_id
      ORDER BY entity_score DESC
      LIMIT ${candidateLimit}
    )
  `;
}

export function extractEntityQueryTerms(query: string): string[] {
  const stopwords = new Set([
    "about",
    "answer",
    "calendar",
    "contact",
    "contacts",
    "diary",
    "did",
    "document",
    "drive",
    "email",
    "feedback",
    "file",
    "gmail",
    "memory",
    "message",
    "project",
    "source",
    "send",
    "summary",
    "what",
    "when",
    "where",
    "which",
    "who",
    "your",
    "cua",
    "cho",
    "da",
    "du",
    "gi",
    "lam",
    "lien",
    "nhat",
    "nguoi",
    "tai",
    "toi",
    "trong",
    "ve",
  ]);

  const terms = normalizeEntityText(query).match(/[\p{L}\p{N}_@.-]+/gu) ?? [];
  return [...new Set(
    terms.filter((term) => term.length >= 3 && !stopwords.has(term)),
  )].slice(0, 10);
}

function normalizeEntityText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildWhereClause(userId: string, filters: RetrievalFilters): PrismaSql {
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

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

function buildEntityWhereClause(userId: string, filters: RetrievalFilters): PrismaSql {
  const conditions: PrismaSql[] = [Prisma.sql`entity_chunks.user_id = ${userId}`];

  if (filters.chunkType) {
    conditions.push(Prisma.sql`entity_chunks.chunk_type = ${filters.chunkType}`);
  }
  if (filters.chunkTypes?.length) {
    conditions.push(
      Prisma.sql`entity_chunks.chunk_type IN (${Prisma.join(filters.chunkTypes)})`,
    );
  }
  if (filters.sourceType) {
    conditions.push(Prisma.sql`entity_chunks.source_type = ${filters.sourceType}`);
  }
  if (filters.sourceTypes?.length) {
    conditions.push(
      Prisma.sql`entity_chunks.source_type IN (${Prisma.join(filters.sourceTypes)})`,
    );
  }
  if (filters.startDate) {
    conditions.push(Prisma.sql`entity_chunks.occurred_at >= ${filters.startDate}`);
  }
  if (filters.endDate) {
    conditions.push(Prisma.sql`entity_chunks.occurred_at <= ${filters.endDate}`);
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

function buildSourceTypeBoost(filters: RetrievalFilters): PrismaSql {
  const preferredSourceTypes = normalizeStringList(filters.preferredSourceTypes);
  return preferredSourceTypes.length
    ? Prisma.sql`
      CASE WHEN memory_chunks.source_type IN (${Prisma.join(preferredSourceTypes)})
        THEN 0.08 ELSE 0 END
    `
    : Prisma.sql`0`;
}

function buildChunkTypeBoost(filters: RetrievalFilters): PrismaSql {
  const preferredChunkTypes = normalizeStringList(filters.preferredChunkTypes);
  return preferredChunkTypes.length
    ? Prisma.sql`
      CASE WHEN memory_chunks.chunk_type IN (${Prisma.join(preferredChunkTypes)})
        THEN 0.06 ELSE 0 END
    `
    : Prisma.sql`0`;
}

function buildSearchDocument(): PrismaSql {
  return Prisma.sql`
    to_tsvector(
      'simple',
      coalesce(text, '') || ' ' || coalesce(evidence, '') || ' ' || coalesce(metadata::text, '')
    )
  `;
}

function markEmbeddingErrorLexicalFallback(hit: MemorySearchHit): MemorySearchHit {
  const metadata = hit.metadata && typeof hit.metadata === "object" && !Array.isArray(hit.metadata)
    ? { ...(hit.metadata as Record<string, unknown>) }
    : {};

  return {
    ...hit,
    metadata: {
      ...metadata,
      retrievalFallback: EMBEDDING_ERROR_LEXICAL_FALLBACK,
    },
  };
}

function shouldUseTemporalFallback(filters: RetrievalFilters): boolean {
  if (!filters.startDate || !filters.endDate) return false;
  if (filters.allowTemporalFallback) return true;

  const start = filters.startDate.getTime();
  const end = filters.endDate.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return false;
  }

  const maxRangeMs = 36 * 60 * 60 * 1000;
  return end - start <= maxRangeMs;
}

function shouldMergeTemporalFallback(
  filters: RetrievalFilters,
  strictResultCount: number,
  limit: number,
): boolean {
  if (!shouldUseTemporalFallback(filters)) return false;
  if (strictResultCount === 0) return true;

  const start = filters.startDate?.getTime() ?? Number.NaN;
  const end = filters.endDate?.getTime() ?? Number.NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return false;
  }

  const spanMs = end - start;
  const monthOrShorterMs = 32 * 24 * 60 * 60 * 1000;
  const targetEvidenceCount = spanMs <= monthOrShorterMs
    ? Math.min(limit, 12)
    : Math.min(limit, 4);

  return strictResultCount < targetEvidenceCount;
}

function dedupeHits(hits: MemorySearchHit[]): MemorySearchHit[] {
  const byId = new Map<string, MemorySearchHit>();
  for (const hit of hits) {
    const existing = byId.get(hit.id);
    if (!existing || hit.similarity > existing.similarity) {
      byId.set(hit.id, hit);
    }
  }

  return [...byId.values()];
}

function compareHits(a: MemorySearchHit, b: MemorySearchHit): number {
  return b.similarity - a.similarity ||
    b.occurredAt.getTime() - a.occurredAt.getTime();
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
