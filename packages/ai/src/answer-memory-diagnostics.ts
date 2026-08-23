import { Prisma } from "@second-brain/db";
import { TUTURUUU_EMBEDDING_MODEL } from "./embedding.ts";
import type { MemoryIndexDiagnostics } from "./answer-memory-types.ts";
import type { RetrievalFilters } from "./retrieval.ts";

type PrismaSql = ReturnType<typeof Prisma.sql>;

type QueryableDbClient = {
  $queryRaw: <T = unknown>(query: PrismaSql) => Promise<T>;
};

type DiagnosticsRow = {
  totalChunks: number | bigint | string | null;
  embeddedChunks: number | bigint | string | null;
  currentEmbeddingModelChunks: number | bigint | string | null;
  staleEmbeddingModelChunks: number | bigint | string | null;
  latestOccurredAt: Date | string | null;
};

export async function getMemoryIndexDiagnostics(
  dbClient: unknown,
  userId: string,
  filters: RetrievalFilters,
): Promise<MemoryIndexDiagnostics | undefined> {
  if (!isQueryableDbClient(dbClient)) return undefined;

  const conditions = buildFilterConditions(userId, filters);
  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  const rows = await dbClient.$queryRaw<DiagnosticsRow[]>(Prisma.sql`
    SELECT
      COUNT(*)::int AS "totalChunks",
      COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS "embeddedChunks",
      COUNT(*) FILTER (
        WHERE
          embedding IS NOT NULL
          AND metadata->>'embeddingModel' = ${TUTURUUU_EMBEDDING_MODEL}
      )::int AS "currentEmbeddingModelChunks",
      COUNT(*) FILTER (
        WHERE
          embedding IS NOT NULL
          AND metadata->>'embeddingModel' IS DISTINCT FROM ${TUTURUUU_EMBEDDING_MODEL}
      )::int AS "staleEmbeddingModelChunks",
      MAX(occurred_at) AS "latestOccurredAt"
    FROM memory_chunks
    ${whereClause}
  `);

  const row = rows[0];
  if (!row) return undefined;

  const totalChunks = toCount(row.totalChunks);
  const embeddedChunks = toCount(row.embeddedChunks);
  const currentEmbeddingModelChunks = toCount(row.currentEmbeddingModelChunks);
  const staleEmbeddingModelChunks = toCount(row.staleEmbeddingModelChunks);

  return {
    embeddingModel: TUTURUUU_EMBEDDING_MODEL,
    totalChunks,
    embeddedChunks,
    currentEmbeddingModelChunks,
    staleEmbeddingModelChunks,
    latestOccurredAt: serializeDate(row.latestOccurredAt),
    issue: classifyIndexIssue({
      totalChunks,
      embeddedChunks,
      currentEmbeddingModelChunks,
      staleEmbeddingModelChunks,
    }),
  };
}

export function shouldAttachMemoryIndexDiagnostics(input: {
  chunksRetrieved: number;
  status?: string;
  noMemory?: boolean;
  hasModelError?: boolean;
}) {
  return (
    input.chunksRetrieved === 0 ||
    input.noMemory === true ||
    input.hasModelError === true ||
    input.status === "no_memory" ||
    input.status === "error"
  );
}

function buildFilterConditions(
  userId: string,
  filters: RetrievalFilters,
): PrismaSql[] {
  const conditions: PrismaSql[] = [Prisma.sql`user_id = ${userId}::text`];

  if (filters.chunkType) {
    conditions.push(Prisma.sql`chunk_type = ${filters.chunkType}`);
  }

  if (filters.chunkTypes?.length) {
    conditions.push(
      Prisma.sql`chunk_type IN (${Prisma.join(filters.chunkTypes)})`,
    );
  }

  if (filters.sourceType) {
    conditions.push(Prisma.sql`source_type = ${filters.sourceType}`);
  }

  if (filters.sourceTypes?.length) {
    conditions.push(
      Prisma.sql`source_type IN (${Prisma.join(filters.sourceTypes)})`,
    );
  }

  if (filters.sourceId) {
    conditions.push(Prisma.sql`source_id = ${filters.sourceId}::text`);
  }

  if (filters.sourceIds?.length) {
    conditions.push(
      Prisma.sql`source_id IN (${Prisma.join(filters.sourceIds)})`,
    );
  }

  if (filters.fileTypePrefixes?.length) {
    conditions.push(
      Prisma.sql`(${Prisma.join(
        filters.fileTypePrefixes.map(
          (prefix) =>
            Prisma.sql`coalesce(metadata->>'fileType', '') LIKE ${`${prefix}%`}`,
        ),
        " OR ",
      )})`,
    );
  }

  if (filters.startDate) {
    conditions.push(Prisma.sql`occurred_at >= ${filters.startDate}`);
  }

  if (filters.endDate) {
    conditions.push(Prisma.sql`occurred_at <= ${filters.endDate}`);
  }

  return conditions;
}

function isQueryableDbClient(value: unknown): value is QueryableDbClient {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as QueryableDbClient).$queryRaw === "function",
  );
}

function classifyIndexIssue(input: {
  totalChunks: number;
  embeddedChunks: number;
  currentEmbeddingModelChunks: number;
  staleEmbeddingModelChunks: number;
}): MemoryIndexDiagnostics["issue"] {
  if (input.totalChunks === 0) return "empty_index";
  if (input.embeddedChunks === 0) return "missing_embeddings";
  if (
    input.currentEmbeddingModelChunks === 0 &&
    input.staleEmbeddingModelChunks > 0
  ) {
    return "stale_embeddings";
  }
  if (input.staleEmbeddingModelChunks > 0) return "mixed_embeddings";
  return "none";
}

function serializeDate(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function toCount(value: number | bigint | string | null): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}
