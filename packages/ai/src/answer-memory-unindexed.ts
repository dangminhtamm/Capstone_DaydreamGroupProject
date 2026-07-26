import { trimPromptQuote } from "./answer-memory-format.ts";
import type { MemoryDbClient } from "./types.ts";
import type { MemorySearchHit, RetrievalFilters } from "./retrieval.ts";

type UnindexedDiaryRow = {
  id: string;
  raw_text: string;
  entry_date: Date | string | null;
  created_at: Date | string;
  job_status: string | null;
};

export async function retrieveUnindexedDiaryFallbackHits(
  dbClient: MemoryDbClient,
  userId: string,
  filters: RetrievalFilters,
): Promise<MemorySearchHit[]> {
  if (!shouldReadUnindexedDiaries(filters)) return [];

  const queryRawUnsafe = (dbClient as {
    $queryRawUnsafe?: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
  }).$queryRawUnsafe?.bind(dbClient);
  if (!queryRawUnsafe) return [];

  let rows: UnindexedDiaryRow[] = [];
  try {
    rows = await queryRawUnsafe<UnindexedDiaryRow[]>(
      `
        SELECT
          d.id,
          d.raw_text,
          d.entry_date,
          d.created_at,
          j.status AS job_status
        FROM diary_entries d
        LEFT JOIN indexing_outbox j
          ON j.job_type = 'index_memory'
         AND j.source_type = 'diary'
         AND j.source_id = d.id
        WHERE d.user_id = $1
          AND (
            d.entry_date BETWEEN $2 AND $3
            OR (d.entry_date IS NULL AND d.created_at BETWEEN $2 AND $3)
          )
          AND NOT EXISTS (
            SELECT 1
            FROM memory_chunks m
            WHERE m.user_id = d.user_id
              AND m.source_type = 'diary'
              AND m.source_id = d.id
          )
        ORDER BY COALESCE(d.entry_date, d.created_at) DESC, d.created_at DESC
        LIMIT $4
      `,
      userId,
      filters.startDate,
      filters.endDate,
      Math.min(filters.limit ?? 8, 8),
    );
  } catch (error) {
    console.warn("[AnswerMemory] Unindexed diary fallback failed:", error);
    return [];
  }

  return rows
    .map((row, index) => buildUnindexedDiaryHit(row, index))
    .filter((hit): hit is MemorySearchHit => hit !== null);
}

function shouldReadUnindexedDiaries(filters: RetrievalFilters): boolean {
  if (!filters.startDate || !filters.endDate) return false;
  if (filters.sourceType && filters.sourceType !== "diary") return false;
  if (filters.sourceTypes?.length && !filters.sourceTypes.includes("diary")) return false;
  if (
    filters.preferredSourceTypes?.length &&
    !filters.preferredSourceTypes.includes("diary")
  ) {
    return false;
  }

  return true;
}

function buildUnindexedDiaryHit(row: UnindexedDiaryRow, index: number): MemorySearchHit | null {
  const rawText = row.raw_text.trim();
  if (!rawText) return null;

  const title = extractDiaryTitle(rawText);
  const occurredAt = row.entry_date ? new Date(row.entry_date) : new Date(row.created_at);

  return {
    id: `unindexed-diary:${row.id}`,
    sourceType: "diary",
    sourceId: row.id,
    chunkType: "general",
    text: trimPromptQuote(rawText, 1200),
    evidence: trimPromptQuote(rawText, 600),
    metadata: {
      sourceType: "diary",
      sourceId: row.id,
      sourceTitle: title,
      chunkIndex: index,
      chunkType: "general",
      date: occurredAt.toISOString(),
      indexingStatus: row.job_status ?? "missing",
      fallback: "unindexed_diary",
    },
    occurredAt,
    distance: null,
    vectorSimilarity: 0,
    lexicalScore: 1,
    retrievalMode: "temporal",
    similarity: 0.72,
  };
}

function extractDiaryTitle(rawText: string): string {
  const firstLine = rawText.split(/\r?\n/, 1)[0]?.trim();
  if (!firstLine) return "Diary entry";
  return trimPromptQuote(firstLine, 80);
}
